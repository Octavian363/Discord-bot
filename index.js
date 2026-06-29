// 1. Încărcarea variabilelor secrete pentru securitate
require('dotenv').config();

// 2. Serverul HTTP pentru compatibilitate obligatorie cu porturile Railway
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Hybrid 85/15 Engine) Online on Railway!\n');
}).listen(port, () => {
   console.log(`[RAILWAY/SERVER] Keep-alive web server running on port ${port}.`);
});

// 3. Importurile necesare din discord.js v14 și Canvas
const { 
    Client, 
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder
} = require('discord.js');
const axios = require('axios');
const { createCanvas } = require('canvas');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const userCaptchas = new Map();
let LOCKDOWN_MODE = false; 

// 🎯 GENERATORUL HIBRID (85% Imagine Geometrică / 15% Text Simplu)
function generateSecurityChallenge(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userCaptchas.set(userId, code); // Salvăm codul generat pentru verificare

    const percentageRoll = Math.random(); // Generează un număr între 0 și 1

    // ----------------------------------------------------
    // CAZ 1: Imagine Geometrică Camuflată (85% șanse)
    // ----------------------------------------------------
    if (percentageRoll < 0.85) {
        const canvas = createCanvas(500, 250);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const shapeType = Math.floor(Math.random() * 2); // 0 = Cerc, 1 = Dreptunghi
        const colorPalettes = [
            { shape: '#FF2222', text: '#E61E1E' }, 
            { shape: '#00FF44', text: '#00E63D' }, 
            { shape: '#0044FF', text: '#003DE6' }, 
            { shape: '#FFB700', text: '#E6A500' }  
        ];
        const palette = colorPalettes[Math.floor(Math.random() * colorPalettes.length)];

        ctx.fillStyle = palette.shape;

        if (shapeType === 0) {
            ctx.beginPath();
            ctx.arc(250, 125, 90, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(100, 50, 300, 150);
        }

        ctx.fillStyle = palette.text;
        ctx.font = 'bold 44px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.save();
        ctx.translate(250, 125);
        ctx.rotate((Math.random() * 0.2) - 0.1); 
        ctx.fillText(code, 0, 0);
        ctx.restore();

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });
        return { type: 'IMAGE', data: attachment };
    } 
    
    // ----------------------------------------------------
    // CAZ 2: Cod Text Simplu în Block (15% șanse)
    // ----------------------------------------------------
    else {
        const textDisplay = `\`\`\`\nCODE: ${code}\n\`\`\``;
        return { type: 'TEXT', data: textDisplay };
    }
}

function createVerificationModal() {
    const modal = new ModalBuilder()
        .setCustomId('modal_captcha_submit')
        .setTitle('Security Verification');

    const codeInput = new TextInputBuilder()
        .setCustomId('input_captcha_field')
        .setLabel('Put the security code here:')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(5)
        .setRequired(true);

    return modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
}

// 🌐 AUTOMATIC SLASH COMMAND SYNC
client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} is online and running on Railway!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            { name: 'setup', description: 'Automatically creates UnVerified/Verified roles, #verify channel, and secures all permissions.' },
            { name: 'verify', description: 'Open the input field directly to put your verification code.' },
            { name: 'lockdown', description: 'Enable lockdown mode. Instantly kicks any new member who joins.' },
            { name: 'unlockdown', description: 'Disable lockdown mode. Allows new members to join normally.' }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Slash commands successfully registered to Discord API.');
    } catch (error) {
        console.error('❌ Failed to sync slash commands:', error.message);
    }
});

// 🚀 CORE INTERACTION HANDLER
client.on('interactionCreate', async (interaction) => {
    
    // ==========================================
    // 1. /SETUP COMMAND
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Access Denied: Administrator permission required.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        let unverifiedRole = guild.roles.cache.find(r => r.name === 'UnVerified') || 
            await guild.roles.create({ name: 'UnVerified', color: '#7f8c8d' }).catch(() => null);

        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified') || 
            await guild.roles.create({ name: 'Verified', color: '#2ecc71' }).catch(() => null);

        if (!unverifiedRole || !verifiedRole) {
            return interaction.editReply({ content: '❌ Role deployment failed. Please check permissions.' });
        }

        let verifyChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'verify' && c.type === ChannelType.GuildText);
        if (!verifyChannel) {
            verifyChannel = await guild.channels.create({
                name: 'verify',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                    { id: unverifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
                    { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }
                ]
            }).catch(() => null);
        }

        if (!verifyChannel) {
            return interaction.editReply({ content: '❌ Error: Failed to generate the verification text channel.' });
        }

        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            if (channel.id === verifyChannel.id) continue;
            try {
                if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false, Connect: false, Speak: false });
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false, Connect: false, Speak: false });
                    await channel.permissionOverwrites.edit(verifiedRole.id, { ViewChannel: true, Connect: true, Speak: true });
                } else {
                    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false, SendMessages: false });
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false, SendMessages: false });
                    await channel.permissionOverwrites.edit(verifiedRole.id, { ViewChannel: true, SendMessages: true });
                }
            } catch (err) {}
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('click_to_verify').setLabel('Get Code').setStyle(ButtonStyle.Primary)
        );

        await verifyChannel.send({
            content: `👋 **Welcome to the server!** Click the **Get Code** button below to receive your security verification challenge. Once verified, this channel will disappear and the server will unlock!`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: `✅ **Automated Security Setup Successful! All channels are now dynamically locked.**` });
    }

    // ==========================================
    // 2. GET CODE BUTTON TRIGGER (SISTEM HIBRID)
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        if (interaction.member.roles.cache.some(r => r.name === 'Verified')) {
            return interaction.reply({ content: '✅ You are already fully verified!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = interaction.user.id;
            const challenge = generateSecurityChallenge(userId);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter the code').setStyle(ButtonStyle.Success)
            );

            if (challenge.type === 'IMAGE') {
                return interaction.editReply({
                    content: `🔒 **Verification Challenge (Visual Check)**\n\nLook closely at the geometric shape below. Find the 5-character camouflaged code and click the button underneath to submit it.`,
                    files: [challenge.data],
                    components: [row]
                });
            } else {
                return interaction.editReply({
                    content: `🔒 **Verification Challenge (Text Check)**\n\nYour security code is listed below:\n${challenge.data}\nClick the button underneath to submit it.`,
                    components: [row]
                });
            }
        } catch (error) {
            console.error(error);
            return interaction.editReply({ content: '❌ Internal security canvas error.' });
        }
    }

    // ==========================================
    // 3. ENTER THE CODE BUTTON TRIGGER
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'trigger_modal_input') {
        if (interaction.member.roles.cache.some(r => r.name === 'Verified')) {
            return interaction.reply({ content: '✅ You are already verified!', ephemeral: true });
        }
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 4. /VERIFY SLASH COMMAND
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        if (interaction.member.roles.cache.some(r => r.name === 'Verified')) {
            return interaction.reply({ content: '✅ You are already verified and have full access!', ephemeral: true });
        }
        if (!userCaptchas.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ You haven\'t generated a code yet! Click **Get Code** first.', ephemeral: true });
        }
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 5. LOCKDOWN & UNLOCKDOWN SLASH COMMANDS
    // ==========================================
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'lockdown') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
            }
            LOCKDOWN_MODE = true;
            return interaction.reply({ content: '🚨 **Lockdown Enabled!** Anti-raid mechanism activated. Any new users joining the server will be immediately kicked.' });
        }

        if (interaction.commandName === 'unlockdown') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
            }
            LOCKDOWN_MODE = false;
            return interaction.reply({ content: '🛡️ **Lockdown Disabled.** New accounts can join normally.' });
        }
    }

    // ==========================================
    // 6. POP-UP MODAL CODE VALIDATION
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode) {
            return interaction.editReply({ content: '❌ Verification session expired. Please click **Get Code** again.' });
        }

        if (enteredCode.toUpperCase() === correctCode.toUpperCase()) {
            userCaptchas.delete(userId); 

            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');

            try {
                if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
                if (verifiedRole) await interaction.member.roles.add(verifiedRole);
                
                return interaction.editReply({ content: '✅ Verification successful! Full access granted.' });
            } catch (roleError) {
                return interaction.editReply({ content: '❌ **Discord Hierarchy Error:** Drag the bot\'s role to the top of the list in Server Settings!' });
            }
        } else {
            return interaction.editReply({ content: '❌ Invalid code! Click **Get Code** again.' });
        }
    }
});

// ==========================================
// 7. ANTI-RAID KICK ON JOIN
// ==========================================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; 

    if (LOCKDOWN_MODE) {
        try {
            await member.send(`🚨 **Security Alert:** You have been kicked from **${member.guild.name}** due to emergency lockdown.`).catch(() => null);
            await member.kick('Emergency Lockdown Mode Active');
            return;
        } catch (err) {}
    }

    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);