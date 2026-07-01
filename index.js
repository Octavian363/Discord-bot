// 1. Load environment variables
require('dotenv').config();

// 2. HTTP Server for Railway port binding compliance
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Verify Post-Captcha Engine) Online on Railway!\n');
}).listen(port, () => {
   console.log(`[RAILWAY/SERVER] Keep-alive web server running on port ${port}.`);
});

// 3. Necessary imports from discord.js v14, Canvas, and File System
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
const { createCanvas, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');

// Register local font to fix the empty squares
try {
    registerFont('./captcha-font.ttf', { family: 'CaptchaFont' });
    console.log('✅ Local font "captcha-font.ttf" registered successfully.');
} catch (fontError) {
    console.error('⚠️ Could not load local font, using system fallback:', fontError.message);
}

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

// 🔴 THE 28 BLACKLISTED ROBLOX GROUPS LIST
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029
];

// Database text files containing blacklisted IDs to scan against
const TXT_BAN_FILES = [
    'Beat Banger Members.txt',
    'Bun fan members.txt',
    'FelinoMembers.txt',
    'user_ids.txt'
];

// Helper to compile the blacklist set
function getBlacklistSet() {
    const blacklistedIds = new Set();
    TXT_BAN_FILES.forEach(fileName => {
        const filePath = path.join(__dirname, fileName);
        if (fs.existsSync(filePath)) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                content.split(/\r?\n/).forEach(line => {
                    const trimmed = line.trim();
                    if (trimmed) blacklistedIds.add(trimmed);
                });
            } catch (err) {
                console.error(`Error reading ${fileName}:`, err.message);
            }
        }
    });
    BLACKLISTED_ROBLOX_GROUPS.forEach(id => blacklistedIds.add(String(id).trim()));
    return blacklistedIds;
}

// 🎯 HYBRID CAPTCHA GENERATOR ENGINE (65% Distorted Box / 30% Geometric Camouflage / 5% Text Only)
function generateSecurityChallenge(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    userCaptchas.set(userId, code);

    const percentageRoll = Math.random();

    if (percentageRoll < 0.65) {
        const canvas = createCanvas(500, 250);
        const ctx = canvas.getContext('2d');
        
        const palettes = [
            { bg: '#0044FF', text: '#0026C4' }, 
            { bg: '#FF2222', text: '#BF1919' }, 
            { bg: '#00FF44', text: '#00BF31' }, 
            { bg: '#FFB700', text: '#D19600' }  
        ];
        const color = palettes[Math.floor(Math.random() * palettes.length)];

        ctx.fillStyle = color.bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = color.text;
        ctx.lineWidth = 3;
        for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.bezierCurveTo(
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height,
                Math.random() * canvas.width, Math.random() * canvas.height
            );
            ctx.stroke();
        }

        ctx.fillStyle = color.text;
        ctx.font = 'bold 52px sans-serif'; 
        ctx.textBaseline = 'middle';

        const startX = 75;
        const spacing = 75;

        for (let i = 0; i < code.length; i++) {
            ctx.save();
            const x = startX + (i * spacing) + (Math.random() * 16 - 8);
            const y = 125 + (Math.random() * 24 - 12);
            const angle = (Math.random() * 0.5) - 0.25; 

            ctx.translate(x, y);
            ctx.rotate(angle);
            ctx.fillText(code[i], 0, 0);
            ctx.restore();
        }

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });
        return { type: 'IMAGE_DISTORTED', data: attachment };
    } 
    else if (percentageRoll < 0.95) {
        const canvas = createCanvas(500, 250);
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const shapeType = Math.floor(Math.random() * 2);
        
        const camouflagePalettes = [
            { shape: '#00FF44', text: '#00EA3B' }, 
            { shape: '#0044FF', text: '#0036E6' }, 
            { shape: '#FF2222', text: '#FF0000' }, 
            { shape: '#FFB700', text: '#F0AA00' }  
        ];
        const palette = camouflagePalettes[Math.floor(Math.random() * camouflagePalettes.length)];

        ctx.fillStyle = palette.shape;

        if (shapeType === 0) {
            ctx.beginPath();
            ctx.arc(250, 125, 95, 0, Math.PI * 2);
            ctx.fill();
        } else {
            ctx.fillRect(100, 50, 300, 150);
        }

        ctx.fillStyle = palette.text;
        ctx.font = 'bold 46px "CaptchaFont"'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.save();
        ctx.translate(250, 125);
        ctx.rotate((Math.random() * 0.16) - 0.08); 
        ctx.fillText(code, 0, 0);
        ctx.restore();

        const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });
        return { type: 'IMAGE_GEOMETRIC', data: attachment };
    } 
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
    console.log(`🤖 Bot ${client.user.tag} is online and operational!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            { name: 'setup', description: 'Automatically creates UnVerified/Verified roles and secures all channel permissions.' },
            { name: 'verify', description: 'Open the input field directly to enter your verification code.' },
            { name: 'scan', description: 'Scans all members against blacklists to ban threats and verify safe accounts.' },
            { name: 'lockdown', description: 'Enable lockdown mode. Instantly kicks any new member who joins.' },
            { name: 'unlockdown', description: 'Disable lockdown mode. Allows new members to join normally.' }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Global slash commands successfully synced with Discord API.');
    } catch (error) {
        console.error('❌ Failed to sync slash commands:', error.message);
    }
});

// 🚀 INTERACTION HANDLER
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
            return interaction.editReply({ content: '❌ Role deployment failed. Please check bot permissions.' });
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
    // 2. GET CODE BUTTON TRIGGER
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        await interaction.deferReply({ ephemeral: true });

        try {
            const userId = interaction.user.id;
            const challenge = generateSecurityChallenge(userId);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter the code').setStyle(ButtonStyle.Success)
            );

            if (challenge.type === 'IMAGE_DISTORTED') {
                return interaction.editReply({
                    content: `🔒 **Verification Challenge (Distorted Engine)**\n\nLook closely at the canvas below. Find the 5-character amestecat code and submit it using the green button.`,
                    files: [challenge.data],
                    components: [row]
                });
            } else if (challenge.type === 'IMAGE_GEOMETRIC') {
                return interaction.editReply({
                    content: `🔒 **Verification Challenge (Camouflage Shape)**\n\nLook closely inside the colored element. Find the 5-character low-visibility code and submit it using the green button.`,
                    files: [challenge.data],
                    components: [row]
                });
            } else {
                return interaction.editReply({
                    content: `🔒 **Verification Challenge (Code Block)**\n\nYour security code is listed below:\n${challenge.data}\nClick the button underneath to submit it.`,
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
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 4. /VERIFY SLASH COMMAND
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'verify') {
        if (!userCaptchas.has(interaction.user.id)) {
            return interaction.reply({ content: '❌ You haven\'t generated a code yet! Click **Get Code** first.', ephemeral: true });
        }
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // ==========================================
    // 5. /SCAN GLOBAL COMMAND
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'scan') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Permission Denied: Administrator access required to execute database scan.', ephemeral: true });
        }

        await interaction.deferReply();
        const blacklistedIds = getBlacklistSet();

        const members = await interaction.guild.members.fetch();
        let banCount = 0;
        let safeCount = 0;

        for (const [id, member] of members) {
            if (member.user.bot) continue;

            if (blacklistedIds.has(member.id)) {
                try {
                    await member.ban({ reason: 'Identified in global security blacklist database (.txt / Roblox Groups)' });
                    banCount++;
                } catch (banErr) {
                    console.error(`Could not ban user ${member.user.tag}:`, banErr.message);
                }
            } else {
                safeCount++;
            }
        }

        return interaction.editReply({ 
            content: `🛡️ **Security Scan Complete!**\nValid/Safe Accounts: **${safeCount}**\nMalicious Accounts Purged (Blacklist/Roblox): **${banCount}**`
        });
    }

    // ==========================================
    // 6. LOCKDOWN & UNLOCKDOWN SLASH COMMANDS
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
    // 7. POP-UP MODAL CODE VALIDATION (CRITICAL LOGIC)
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        const userId = interaction.user.id;
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode) {
            return interaction.editReply({ content: '❌ Verification session expired. Please click **Get Code** again.' });
        }

        // Pasul 1: Verificăm dacă codul Captcha este corect
        if (enteredCode.toUpperCase() === correctCode.toUpperCase()) {
            userCaptchas.delete(userId); 

            // Pasul 2: Verificăm imediat dacă utilizatorul este sigur în baza de date
            const blacklistedIds = getBlacklistSet();

            if (blacklistedIds.has(userId)) {
                try {
                    await interaction.user.send(`❌ You have been kicked from **${interaction.guild.name}** because your account was flagged in our security database.`).catch(() => null);
                    await interaction.member.kick('Auto-Kicked: Flagged in global security blacklist database during verification.');
                    return interaction.editReply({ content: '❌ Verification failed: Your account is flagged as unsafe.' });
                } catch (kickErr) {
                    return interaction.editReply({ content: '❌ Unsafe account detected, but bot failed to kick due to role hierarchy.' });
                }
            }

            // Pasul 3: Contul este sigur! Oferim rolurile
            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');

            try {
                if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
                if (verifiedRole) await interaction.member.roles.add(verifiedRole);
                
                // Trimitem mesajul de întâmpinare pe canalul general
                const generalChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'general' && c.type === ChannelType.GuildText);
                if (generalChannel) {
                    await generalChannel.send(`🛡️ ${interaction.user} your account is safe. Welcome to the server!`).catch(() => null);
                }

                return interaction.editReply({ content: '✅ Verification successful! Welcome!' });
            } catch (roleError) {
                return interaction.editReply({ content: '❌ **Discord Hierarchy Error:** Drag the bot\'s role to the top of the list in Server Settings!' });
            }
        } else {
            return interaction.editReply({ content: '❌ Invalid code! Click **Get Code** again.' });
        }
    }
});

// ==========================================
// 8. ANTI-RAID KICK ON JOIN (Puts UnVerified role)
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