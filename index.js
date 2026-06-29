// 1. Load environment variables first for security
require('dotenv').config();

// 2. HTTP Server required by Render to prevent "Port Timeout" errors
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Mobile Voice Fix + Dynamic Visibility) Online!\n');
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

// Clean code generator
function generateSecureCode(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userCaptchas.set(userId, code);
    return `\`\`\`\nCODE: ${code}\n\`\`\``;
}

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
    console.log(`🤖 Bot ${client.user.tag} is running with hidden-channel logic!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            {
                name: 'setup',
                description: 'Automatically creates UnVerified/Verified roles and configures hidden channel overrides.'
            },
            {
                name: 'verify',
                description: 'Open the input field directly to put your verification code.'
            },
            {
                name: 'lockdown',
                description: 'Enable lockdown mode. Instantly kicks any new member who joins.'
            },
            {
                name: 'unlockdown',
                description: 'Disable lockdown mode. Allows new members to join normally.'
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Commands synchronized successfully.');
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
            return interaction.editReply({ content: '❌ Role deployment failed.' });
        }

        // C. Configurare canal #verify: ascuns COMPLET pentru Verified și @everyone, vizibil DOAR pentru UnVerified
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
                        deny: [PermissionFlagsBits.ViewChannel] // Când primesc rolul Verified, canalul DISPARE complet pentru ei!
                    }
                ]
            }).catch(() => null);
        }

        if (!verifyChannel) {
            return interaction.editReply({ content: '❌ Error: Failed to generate verification channel.' });
        }

        // D. BLOCARE TOTALĂ CANALE PENTRU UTILIZATORII MOBILI ȘI TELEFOANE
        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            if (channel.id === verifyChannel.id) continue;
            
            try {
                if (channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice) {
                    // Nimeni fără rol nu poate intra sau vorbi pe mobil/desktop
                    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { Connect: false, Speak: false, ViewChannel: false });
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { Connect: false, Speak: false, ViewChannel: false });
                    await channel.permissionOverwrites.edit(verifiedRole.id, { Connect: true, Speak: true, ViewChannel: true });
                } else {
                    // Canalele text devin invizibile pentru cei neverificați
                    await channel.permissionOverwrites.edit(guild.roles.everyone.id, { ViewChannel: false });
                    await channel.permissionOverwrites.edit(unverifiedRole.id, { ViewChannel: false });
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

        return interaction.editReply({ content: `✅ **Automated Security Setup Successful! Mobile and Hide-On-Success filters are now active.**` });
    }

    // ==========================================
    // 2. GET CODE BUTTON TRIGGER
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        // Dacă utilizatorul are deja rolul Verified, nu îl lăsăm să ruleze codul
        if (interaction.member.roles.cache.some(r => r.name === 'Verified')) {
            return interaction.reply({ content: '✅ You are already fully verified!', ephemeral: true });
        }

        try {
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
        } catch (error) {
            return interaction.reply({ content: '❌ Internal security error.', ephemeral: true });
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

            // Oferim accesul complet și eliminăm rolul restrictiv
            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

            return interaction.editReply({ content: '✅ Verification successful! Full access granted. The verification channel has been hidden from your view.' });
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