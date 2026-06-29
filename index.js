// 1. Load environment variables first for security
require('dotenv').config();

// 2. HTTP Server required by Render to prevent "Port Timeout" errors
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Anti-Raid + Auto-Permissions) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Keep-alive server running on port ${port}.`);
});

// 3. Import required modules from discord.js v14
const { 
    Client, 
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { Captcha } = require('captcha-canvas');
const { registerFont } = require('canvas'); 
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 🔍 REGISTER LOCAL FONT BEFORE BOT LAUNCH
try {
    const fontPath = path.join(__dirname, 'captcha-font.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'CaptchaCustomFont' });
        console.log('✅ [FONT] Custom CAPTCHA font successfully registered!');
    }
} catch (fontError) {
    console.error('❌ [FONT] Failed to register local font:', fontError.message);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.MessageContent
    ]
});

// 🛡️ SECURITY CONFIGURATION (ID-urile tale sunt salvate direct aici!)
const ROL_UNVERIFIED_ID = '1521105002813194362'; 
const ROL_VERIFIED_ID = '1521105444565942362';   

const userCaptchas = new Map();
let joinLog = []; 
const RAID_THRESHOLD = 5; 
const RAID_INTERVAL = 3000; 
let LOCKDOWN_MODE = false; 

const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029
]; 

let BLACKLISTED_DISCORD_USERS = [];

async function generateAndSaveCaptcha(userId) {
    const captcha = new Captcha();
    captcha.async = true;
    captcha.font = 'CaptchaCustomFont'; 
    captcha.addDecoy(); 
    captcha.drawTrace(); 
    captcha.drawCaptcha();

    userCaptchas.set(userId, captcha.text);
    return new AttachmentBuilder(await captcha.png, { name: 'captcha.png' });
}

// Căutare sau generare automată a canalului text numit "verify" cu permisiuni automate de blocare!
async function getVerifyChannel(guild) {
    let channel = guild.channels.cache.find(c => c.name.toLowerCase() === 'verify' && c.type === ChannelType.GuildText);
    if (!channel) {
        channel = await guild.channels.create({
            name: 'verify',
            type: ChannelType.GuildText,
            permissionOverwrites: [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.ViewChannel] // Ascunde canalul global, îl deschidem doar pentru UnVerified
                },
                {
                    id: ROL_UNVERIFIED_ID,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                    deny: [PermissionFlagsBits.SendMessages] // Ei pot doar să vadă și să apese pe buton
                },
                {
                    id: ROL_VERIFIED_ID,
                    deny: [PermissionFlagsBits.ViewChannel] // Odată verificați, canalul dispare pentru ei ca să fie serverul curat
                }
            ]
        }).catch(() => null);
    }
    return channel;
}

// FUNCȚIE AUTOMATĂ DE CONFIGURARE PERMISIUNI PE TOATE CANALELE DIN SERVER
async function autoConfigureServerPermissions(guild, verifyChannelId) {
    console.log(`⚙️ [PERMS] Pornesc configurarea automată a permisiunilor pe server...`);
    const channels = guild.channels.cache;

    for (const [id, channel] of channels) {
        // Omitem canalul de verificare, pe restul le blocăm complet pentru cei neverificați
        if (channel.id === verifyChannelId) continue;

        try {
            await channel.permissionOverwrites.edit(ROL_UNVERIFIED_ID, {
                ViewChannel: false,
                SendMessages: false,
                ReadMessageHistory: false
            });
        } catch (err) {
            console.error(`Nu am putut modifica canalul ${channel.name}:`, err.message);
        }
    }
    console.log(`✅ [PERMS] Toate canalele au fost securizate!`);
}

async function sendVerificationPanel(guild, member) {
    const verifyChannel = await getVerifyChannel(guild);
    if (!verifyChannel) return;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('click_to_verify')
            .setLabel('Verify')
            .setStyle(ButtonStyle.Success)
    );

    await verifyChannel.send({
        content: `👋 I see your account isn't verified, ${member}. Verify now!`,
        components: [row]
    }).catch(() => null);

    // Lansează configurarea automată a permisiunilor pentru canale ca să nu lucrezi tu manual
    await autoConfigureServerPermissions(guild, verifyChannel.id);
}

client.once('ready', () => {
    console.log(`🤖 Global Security Shield activează cu succes pe ID-urile tale!`);
});

client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; 
    const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
    await sendVerificationPanel(member.guild, member);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content === '.setup' && message.member.permissions.has(PermissionFlagsBits.Administrator)) {
        await sendVerificationPanel(message.guild, message.author);
        return message.delete().catch(() => null);
    }

    const verifyChannel = await getVerifyChannel(message.guild);
    if (verifyChannel && message.channel.id !== verifyChannel.id) {
        if (message.member.roles.cache.has(ROL_UNVERIFIED_ID) || !message.member.roles.cache.has(ROL_VERIFIED_ID)) {
            await message.delete().catch(() => null);
            await sendVerificationPanel(message.guild, message.author);
        }
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        const userId = interaction.user.id;
        const attachment = await generateAndSaveCaptcha(userId);

        const modal = new ModalBuilder()
            .setCustomId('modal_captcha_submit')
            .setTitle('Security Shield Verification');

        const codeInput = new TextInputBuilder()
            .setCustomId('input_captcha_field')
            .setLabel('Enter the code that you see in that box')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(6)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(codeInput);
        modal.addComponents(row);

        await interaction.reply({
            content: `🗂️ **Privește imaginea de mai jos și completează codul în fereastra pop-up:**`,
            files: [attachment],
            ephemeral: true
        });

        await interaction.showModal(modal).catch(() => null);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        const userId = interaction.user.id;
        const codIntrodus = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const codCorect = userCaptchas.get(userId);

        if (!codCorect) {
            return interaction.reply({ content: '❌ Sesiune expiratã. Apasã din nou pe butonul Verify.', ephemeral: true });
        }

        if (codIntrodus.toUpperCase() === codCorect.toUpperCase()) {
            userCaptchas.delete(userId); 

            const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

            return interaction.reply({ content: '✅ Verification successful! Your account has been fully authenticated. Welcome!', ephemeral: true });
        } else {
            return interaction.reply({ content: '❌ Invalid code! Click the **Verify** button again to get a fresh box.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);