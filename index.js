require('dotenv').config();
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Security Shield (Advanced Commands + Kick Lockdown) Online!\n');
}).listen(port);

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
    TextInputStyle
} = require('discord.js');
const axios = require('axios');

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
let LOCKDOWN_MODE = false; // Controls the auto-kick feature

// Generates a random secure code
function generateSecureCode(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userCaptchas.set(userId, code);
    return `\`\`\`\n      ${code.split('').join('  ')}      \n\`\`\``;
}

// Global function to build the code input modal window
function createVerificationModal() {
    const modal = new ModalBuilder()
        .setCustomId('modal_captcha_submit')
        .setTitle('Security Verification');

    const codeInput = new TextInputBuilder()
        .setCustomId('input_captcha_field')
        .setLabel('Put the code:')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(10)
        .setRequired(true);

    return modal.addComponents(new ActionRowBuilder().addComponents(codeInput));
}

// 🌐 AUTOMATIC SLASH COMMAND SYNC
client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} is operational!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            { name: 'setup', description: 'Automatically deploys configuration, channels, and roles.' },
            { name: 'verify', description: 'Open the input field directly to put your verification code.' },
            { name: 'lockdown', description: 'Enable lockdown mode. Instantly kicks any new member who joins.' },
            { name: 'unlockdown', description: 'Disable lockdown mode. Allows new members to join normally.' }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Commands successfully synchronized.');
    } catch (error) {
        console.error('❌ Sync failed:', error.message);
    }
});

// 🚀 LOGIC CONTROLLER FOR INTERACTIONS
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

        let verifyChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'verify' && c.type === ChannelType.GuildText);
        if (!verifyChannel) {
            verifyChannel = await guild.channels.create({
                name: 'verify',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: unverifiedRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
                    { id: verifiedRole.id, deny: [PermissionFlagsBits.ViewChannel] }
                ]
            }).catch(() => null);
        }

        // Lock text and voice channels for UnVerified users
        guild.channels.cache.forEach(async (channel) => {
            if (channel.id === verifyChannel.id) return;
            try {
                if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false, Connect: false, Speak: false });
                } else {
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false, SendMessages: false, ReadMessageHistory: false });
                }
            } catch (err) {}
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('generate_new_code').setLabel('Get Code').setStyle(ButtonStyle.Primary)
        );

        await verifyChannel.send({
            content: `👋 **Welcome!** Click the **Get Code** button below to receive your security code challenge.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: '✅ Automated security configuration successfully loaded!' });
    }

    // ==========================================
    // 2. GET CODE BUTTON (PRIMEȘTE TEXTUL ȘI BUTONUL ENTER CODE SUB EL)
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'generate_new_code') {
        const userId = interaction.user.id;
        const codeDisplay = generateSecureCode(userId);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter the code').setStyle(ButtonStyle.Success)
        );

        return interaction.reply({
            content: `🔒 **Verification Challenge**\n\nYour security code is listed below:\n${codeDisplay}\nClick the button underneath to submit it. You can also use \`/verify\`.`,
            components: [row],
            ephemeral: true
        });
    }

    // ==========================================
    // 3. ENTER THE CODE BUTTON TRIGGER
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'trigger_modal_input') {
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 4. /VERIFY COMMAND (ALTERNATIVE INPUT)
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        if (!userCaptchas.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ You haven\'t generated a code yet! Click **Get Code** in the verification channel first.', ephemeral: true });
        }
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 5. LOCKDOWN & UNLOCKDOWN CONTROL
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
            return interaction.reply({ content: '🛡️ **Lockdown Disabled.** The server is now open. New accounts can join and complete verification normally.' });
        }
    }

    // ==========================================
    // 6. POP-UP MODAL SUBMISSION VALIDATION
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode) {
            return interaction.editReply({ content: '❌ Verification session expired or missing. Please click **Get Code** again.' });
        }

        if (enteredCode.toUpperCase() === correctCode.toUpperCase()) {
            userCaptchas.delete(userId);
            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');

            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

            return interaction.editReply({ content: '✅ Verification successful! Full text and voice access has been unlocked. Welcome!' });
        } else {
            return interaction.editReply({ content: '❌ Invalid code! Click **Get Code** again to get a fresh challenge.' });
        }
    }
});

// ==========================================
// 7. ANTI-RAID AUTOMATIC KICK (ON GUILD MEMBER ADD)
// ==========================================
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;

    // IF LOCKDOWN MODE IS TRUE -> KICK IMMEDIATELY
    if (LOCKDOWN_MODE) {
        try {
            await member.send(`🚨 **Security Alert:** You have been kicked from **${member.guild.name}** because the server is currently under emergency lockdown. Please try joining again later.`).catch(() => null);
            await member.kick('Emergency Lockdown Mode Active (Anti-Raid)').then(() => {
                console.log(`🔨 [LOCKDOWN] Kicked joining user: ${member.user.tag}`);
            });
            return; // Stops here, doesn't give roles
        } catch (kickError) {
            console.error(`Could not kick user during lockdown: ${kickError.message}`);
        }
    }

    // Normal join process if lockdown is disabled
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);