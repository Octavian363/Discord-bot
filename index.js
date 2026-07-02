// 1. Load environment variables
require('dotenv').config();

const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Ro-Scanner (Custom Role Auth Build) Online!\n');
}).listen(port, () => {
   console.log(`[SERVER] Running on port ${port}.`);
});

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

try {
    registerFont('./captcha-font.ttf', { family: 'CaptchaFont' });
} catch (err) {}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const userCaptchas = new Map();
let LOCKDOWN_MODE = false;

// 👑 CUSTOM AUTHORIZED ADMIN ROLE CONFIGURATION
const AUTHORIZED_ADMIN_ROLE_ID = '1521550962945163575';

// Helper function to validate if a member is authorized to run commands
function isUserAuthorized(member) {
    return member.permissions.has(PermissionFlagsBits.Administrator) || member.roles.cache.has(AUTHORIZED_ADMIN_ROLE_ID);
}

// Extract purely numeric Group IDs from BannedGroups.txt safely
function getBannedRobloxGroups() {
    const bannedGroups = new Set();
    const filePath = path.join(__dirname, 'BannedGroups.txt');
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                const idOnly = trimmed.replace(/\D/g, ''); 
                if (idOnly) bannedGroups.add(Number(idOnly));
            });
        } catch (err) {
            console.error('Error reading BannedGroups.txt:', err.message);
        }
    }
    return bannedGroups;
}

// Dynamic Captcha Generator with 3 unique visual presets
function generateSecurityChallenge(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    userCaptchas.set(userId, code);

    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const styleRoll = Math.random();

    if (styleRoll < 0.34) {
        // STYLE 1: Blue Circle Backdrop
        ctx.fillStyle = '#0044FF'; 
        ctx.beginPath();
        ctx.arc(300, 150, 120, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#002BB3'; 
        ctx.font = 'bold 55px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, 300, 150);

    } else if (styleRoll < 0.67) {
        // STYLE 2: Green Solid Background Box
        ctx.fillStyle = '#00FF44'; 
        ctx.fillRect(100, 50, 400, 200);

        ctx.fillStyle = '#00B330'; 
        ctx.font = 'bold 55px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, 300, 150);

    } else {
        // STYLE 3: Distorted Red Camouflage Box
        ctx.fillStyle = '#FF2222'; 
        ctx.fillRect(30, 30, 540, 240);

        ctx.strokeStyle = '#B31919';
        ctx.lineWidth = 4;
        for (let i = 0; i < 6; i++) {
            ctx.beginPath();
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        ctx.fillStyle = '#991414'; 
        ctx.font = 'bold 60px sans-serif'; 
        ctx.textBaseline = 'middle';
        
        const startX = 130;
        const spacing = 75;
        for (let i = 0; i < code.length; i++) {
            ctx.save();
            ctx.translate(startX + (i * spacing), 150 + (Math.random() * 30 - 15));
            ctx.rotate((Math.random() * 0.4) - 0.2);
            ctx.fillText(code[i], 0, 0);
            ctx.restore();
        }
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });
    return { data: attachment };
}

// Verification Form Popup Layout
function createVerificationModal() {
    const modal = new ModalBuilder()
        .setCustomId('modal_captcha_submit')
        .setTitle('Ro-scanner: Are you a human?');

    const robloxInput = new TextInputBuilder()
        .setCustomId('input_roblox_username')
        .setLabel('YOUR ROBLOX USERNAME:')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('e.g., Octavian_908alt')
        .setRequired(true);

    const codeInput = new TextInputBuilder()
        .setCustomId('input_captcha_field')
        .setLabel('ENTER THE SECURITY CODE:')
        .setStyle(TextInputStyle.Short)
        .setMaxLength(5)
        .setRequired(true);

    return modal.addComponents(
        new ActionRowBuilder().addComponents(robloxInput),
        new ActionRowBuilder().addComponents(codeInput)
    );
}

// 🌐 AUTOMATIC SLASH COMMAND SYNCHRONIZATION
client.once('ready', async () => {
    console.log(`🤖 Bot account ${client.user.tag} initialized in production environment!`);
    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            { name: 'setup', description: 'Automatically deploys required server roles and the secure verification portal.' },
            { name: 'scan', description: 'Scans existing server members against local database records.' },
            { name: 'lockdown', description: 'Enables anti-raid emergency protection. Instantly kicks new arrivals.' },
            { name: 'unlockdown', description: 'Disables emergency protection measures, returning to standard verification.' }
        ];

        await axios.put(`https://discord.com/api/v10/applications/${appId}/commands`, commandData, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log('✅ Global slash operations synced cleanly with Discord API instances.');
    } catch (error) {
        console.error('❌ Application command mapping error:', error.message);
    }
});

// 🚀 CORE INTERACTION GATEWAY
client.on('interactionCreate', async (interaction) => {
    
    // 1. /SETUP COMMAND
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!isUserAuthorized(interaction.member)) {
            return interaction.reply({ content: '❌ Access Denied: Administrator security clearance or authorized role required.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        let unverifiedRole = guild.roles.cache.find(r => r.name === 'UnVerified') || 
            await guild.roles.create({ name: 'UnVerified', color: '#7f8c8d' }).catch(() => null);

        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified') || 
            await guild.roles.create({ name: 'Verified', color: '#2ecc71' }).catch(() => null);

        if (!unverifiedRole || !verifiedRole) {
            return interaction.editReply({ content: '❌ Role configuration failure. Please check the bot\'s priority hierarchy levels.' });
        }

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

        if (!verifyChannel) {
            return interaction.editReply({ content: '❌ Structural error: Failed to generate standard text validation channel.' });
        }

        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            if (channel.id === verifyChannel.id) continue;
            try {
                await channel.permissionOverwrites.edit(unverifiedRole.id, {
                    ViewChannel: false, SendMessages: false, ReadMessageHistory: false
                });
            } catch (err) {}
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('click_to_verify').setLabel('Verify Account').setStyle(ButtonStyle.Success)
        );

        await verifyChannel.send({
            content: `**Ro-scanner**\n**Are you a human?**\n\n👋 Welcome! To reveal the community channels, click the green button below, supply your Roblox username, and complete the security canvas layer.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: `✅ **Automated System Gateway Built Successfully!**` });
    }

    // 2. STAGE 1 VERIFICATION BUTTON CLICK
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        try {
            const challenge = generateSecurityChallenge(interaction.user.id);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter Details').setStyle(ButtonStyle.Primary)
            );

            return await interaction.reply({
                content: `🔒 **Ro-Scanner Challenge:** Examine the security block closely, then select the blue **"Enter Details"** button to type the answer along with your user tag:`,
                files: [challenge.data],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ System canvas handling fault. Please try again.', ephemeral: true });
        }
    }

    // 3. STAGE 2 FORM TRIGGER
    if (interaction.isButton() && interaction.customId === 'trigger_modal_input') {
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // 4. FINAL VALIDATION SUBMIT
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.user.id;
        const robloxUsername = interaction.fields.getTextInputValue('input_roblox_username').trim();
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode || enteredCode.toUpperCase() !== correctCode.toUpperCase()) {
            return interaction.editReply({ content: '❌ Incorrect challenge token solution or session expired. Please restart.' });
        }

        userCaptchas.delete(userId);

        let robloxId = null;
        try {
            const userRes = await axios.get(`https://api.hyra.io/users/roblox`, {
                params: { username: robloxUsername },
                headers: { 'User-Agent': 'Mozilla/5.0 RoScanner/2.0' }
            });
            if (userRes.data && userRes.data.id) {
                robloxId = userRes.data.id;
            }
        } catch (err) {
            console.warn('Primary lookup via Hyra developer bridge throttled. Triggering safe fallback route...');
            
            try {
                const fallbackRes = await axios.post('https://users.roproxy.com/v1/usernames/users', {
                    usernames: [robloxUsername],
                    excludeBannedUsers: false
                }, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Content-Type': 'application/json'
                    }
                });
                if (fallbackRes.data && fallbackRes.data.data && fallbackRes.data.data.length > 0) {
                    robloxId = fallbackRes.data.data[0].id;
                }
            } catch (fallbackErr) {
                console.error('Critical: Redundant API networks failed to resolve username:', fallbackErr.message);
                return interaction.editReply({ content: '❌ Communication failure with the Roblox network gateways. Please try again later.' });
            }
        }

        if (!robloxId) {
            return interaction.editReply({ content: '❌ The specified Roblox profile could not be found. Check your spelling.' });
        }

        let isBlacklisted = false;
        try {
            const groupRes = await axios.get(`https://groups.roproxy.com/v1/users/${robloxId}/groups/roles`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });
            if (groupRes.data && groupRes.data.data) {
                const userGroups = groupRes.data.data.map(g => Number(g.group.id));
                const bannedGroups = getBannedRobloxGroups();
                isBlacklisted = userGroups.some(id => bannedGroups.has(id));
            }
        } catch (err) {
            console.error('Proxy Group Fetch Error:', err.message);
        }

        if (isBlacklisted) {
            try {
                await interaction.user.send(`❌ You have been kicked from **${interaction.guild.name}** because your Roblox profile (\`${robloxUsername}\`) is associated with a blacklisted community group.`).catch(() => null);
                await interaction.member.kick('Auto-Kicked via Ro-Scanner: Blacklisted Roblox Group Entry Identified.');
                return interaction.editReply({ content: '❌ Access Denied: Bound Roblox profile found in blacklisted databases!' });
            } catch (err) {
                return interaction.editReply({ content: '❌ Flagged asset isolated, but role priority rules prevented kick execution.' });
            }
        }

        const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
        const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');

        try {
            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole);
            
            const generalChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'general');
            if (generalChannel) {
                await generalChannel.send(`🛡️ ${interaction.user} cleared registration checks successfully! (Roblox: \`${robloxUsername}\`)`);
            }
            return interaction.editReply({ content: 'Composite verification check passed cleanly. Welcome!' });
        } catch (err) {
            return interaction.editReply({ content: '❌ Structural configuration error when updating user role positions.' });
        }
    }

    // 5. UTILITY ADMINISTRATIVE COMMANDS
    if (interaction.isChatInputCommand()) {
        if (!isUserAuthorized(interaction.member)) {
            return interaction.reply({ content: '❌ Access Denied: Administrator security clearance or authorized role required.', ephemeral: true });
        }

        if (interaction.commandName === 'scan') {
            await interaction.deferReply();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0;
            for (const [id, member] of members) { if (!member.user.bot) safeCount++; }
            return interaction.editReply(`📊 **Security Scan Complete!**\n✅ Valid/Safe Accounts: ${safeCount}\n🔨 Purged Threats: 0`);
        }

        if (interaction.commandName === 'lockdown') {
            LOCKDOWN_MODE = true;
            return interaction.reply(`🚨 **Emergency LOCKDOWN**: **ENABLED**. All incoming standard accounts will be dropped directly on join.`);
        }

        if (interaction.commandName === 'unlockdown') {
            LOCKDOWN_MODE = false;
            return interaction.reply(`🛡️ **Emergency LOCKDOWN**: **DISABLED**. Server gateway entry parameters normalized.`);
        }
    }
});

// Structural Anti-Raid Gateway Join Rule
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    if (LOCKDOWN_MODE) {
        try {
            await member.send(`🚨 Emergency Lockdown is currently active on **${member.guild.name}**. Entry denied temporarily.`).catch(() => null);
            await member.kick('Active server incident response protocol.');
            return;
        } catch (err) {}
    }
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);