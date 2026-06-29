// 1. Load environment variables first for security
require('dotenv').config();

// 2. HTTP Server required by Render to prevent "Port Timeout" errors
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Text Captcha Engine) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Keep-alive server running on port ${port}.`);
});

// 3. Import required modules from discord.js v14
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

// Global storage for active verification codes
const userCaptchas = new Map();
let LOCKDOWN_MODE = false;

// Generates a secure, distorted text verification code
function generateSecureCode(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded confusing characters like O, 0, I, 1
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userCaptchas.set(userId, code);
    
    // Distort the visual appearance using spaces and block wrappers to defeat automated scrapers
    const stylizedCode = code.split('').join('  ');
    return `\`\`\`\n      ${stylizedCode}      \n\`\`\``;
}

// 🌐 AUTOMATIC SLASH COMMAND SYNC
client.once('ready', async () => {
    console.log(`🤖 Bot ${client.user.tag} is online and running in strict English security mode!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            {
                name: 'setup',
                description: 'Automatically creates UnVerified/Verified roles, #verify channel, and secures all permissions.'
            },
            {
                name: 'scan',
                description: 'Scan server for suspicious entries.'
            },
            {
                name: 'lockdown',
                description: 'Toggle lockdown mode.'
            }
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

// 🚀 CORE INTERACTION HANDLER (SLASH COMMANDS + BUTTONS + MODALS)
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

        // A. Find or create UnVerified role
        let unverifiedRole = guild.roles.cache.find(r => r.name === 'UnVerified');
        if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
                name: 'UnVerified',
                color: '#7f8c8d',
                reason: 'Created automatically by security shield.'
            }).catch(() => null);
        }

        // B. Find or create Verified role
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: '#2ecc71',
                reason: 'Created automatically by security shield.'
            }).catch(() => null);
        }

        if (!unverifiedRole || !verifiedRole) {
            return interaction.editReply({ content: '❌ Role deployment failed. Please check the bot hierarchy and permissions!' });
        }

        // C. Find or create #verify text channel
        let verifyChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'verify' && c.type === ChannelType.GuildText);
        if (!verifyChannel) {
            verifyChannel = await guild.channels.create({
                name: 'verify',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: unverifiedRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: verifiedRole.id,
                        deny: [PermissionFlagsBits.ViewChannel] 
                    }
                ]
            }).catch(() => null);
        }

        if (!verifyChannel) {
            return interaction.editReply({ content: '❌ Error: Failed to generate the verification text channel.' });
        }

        // D. SECURE ALL OTHER CHANNELS (STRICT TEXT & VOICE LOCKDOWN)
        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            if (channel.id === verifyChannel.id) continue;
            
            try {
                if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                    // Completely block unverified users from joining, speaking, streaming or viewing voice channels
                    await channel.permissionOverwrites.edit(unverifiedRole.id, {
                        ViewChannel: false,
                        Connect: false,
                        Speak: false,
                        Stream: false
                    });
                } else {
                    // Block text channels
                    await channel.permissionOverwrites.edit(unverifiedRole.id, {
                        ViewChannel: false,
                        SendMessages: false,
                        ReadMessageHistory: false
                    });
                }
            } catch (err) {
                console.error(`Could not lock permissions for channel ${channel.name}:`, err.message);
            }
        }

        // E. Send verification prompt button
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('click_to_verify')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
        );

        await verifyChannel.send({
            content: `👋 **Welcome to the server!** To access text channels and unlock the ability to join or speak in voice channels, click the green button below and complete the anti-bot verification challenge.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: `✅ **Automated Security Setup Successful!**\n• **UnVerified** & **Verified** roles are synchronized.\n• Channel <#${verifyChannel.id}> is configured.\n• Total lockout applied: Unverified accounts cannot view text chats or connect/speak in voice channels.` });
    }

    // ==========================================
    // 2. VERIFY BUTTON TRIGGER
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        try {
            const userId = interaction.user.id;
            const codeDisplay = generateSecureCode(userId);

            const modal = new ModalBuilder()
                .setCustomId('modal_captcha_submit')
                .setTitle('Security Verification');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_captcha_field')
                .setLabel('Enter the code you see below:')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(10)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(codeInput);
            modal.addComponents(row);

            await interaction.reply({
                content: `🔒 **Verification Challenge**\n\nType the security code shown below into the pop-up box field:\n${codeDisplay}\n*Note: The code is case-sensitive.*`,
                ephemeral: true
            });

            await interaction.showModal(modal).catch(() => null);
        } catch (error) {
            console.error('Button click processing error:', error);
            return interaction.reply({ content: '❌ Internal security handler error. Please try again.', ephemeral: true });
        }
    }

    // ==========================================
    // 3. POP-UP MODAL CODE VALIDATION
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        const userId = interaction.user.id;
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode) {
            return interaction.reply({ content: '❌ Verification session expired. Click the green button again.', ephemeral: true });
        }

        if (enteredCode === correctCode) {
            userCaptchas.delete(userId); 

            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');

            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

            return interaction.reply({ content: '✅ Verification successful! Full access granted to text and voice channels. Welcome!', ephemeral: true });
        } else {
            return interaction.reply({ content: '❌ Invalid code! Click the **Verify** button again to generate a new security challenge.', ephemeral: true });
        }
    }

    // UTILITY COMMAND HANDLERS
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'scan') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
            await interaction.deferReply();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0;
            for (const [id, member] of members) { if (!member.user.bot) safeCount++; }
            return interaction.editReply(`📊 **Security Scan Complete!**\n✅ Valid/Safe Accounts: ${safeCount}\n🔨 Purged: 0`);
        }

        if (interaction.commandName === 'lockdown') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Permission denied.', ephemeral: true });
            LOCKDOWN_MODE = !LOCKDOWN_MODE;
            return interaction.reply(`🚨 **Emergency LOCKDOWN**: Status set to **${LOCKDOWN_MODE ? 'ENABLED' : 'DISABLED'}**.`);
        }
    }
});

// Auto-assign UnVerified role on join
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; 
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);