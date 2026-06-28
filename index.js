// 1. Load environment variables first for security
require('dotenv').config();

// 2. HTTP Server required by Render to prevent "Port Timeout" errors
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Anti-Raid + Canvas CAPTCHA) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Keep-alive server running on port ${port}.`);
});

// 3. Import required modules from discord.js v14
const { 
    Client, 
    GatewayIntentBits,
    PermissionFlagsBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const { Captcha } = require('captcha-canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Enable full client intents using standard v14 layout
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildPresences
    ]
});

// 🛡️ SECURITY CONFIGURATION (Replace with your actual Discord Server Role IDs)
const ROL_UNVERIFIED_ID = 'ID_ROL_NEVERIFICAT'; // Restrictive role given upon joining
const ROL_VERIFIED_ID = 'ID_ROL_VERIFICAT';     // Main access member role given after CAPTCHA

// Memory cache to map active CAPTCHAs (User ID -> Generated Code Text)
const userCaptchas = new Map();

// 🛑 AUTOMATED ANTI-RAID SYSTEM (Protection for Crypto/NFT/Twitch servers)
let joinLog = []; 
const RAID_THRESHOLD = 5; 
const RAID_INTERVAL = 3000; 
let LOCKDOWN_MODE = false; 

// 🛡️ Roblox Condo Groups Blacklist
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

// Dynamic memory cache for local text database (.txt files)
let BLACKLISTED_DISCORD_USERS = [];

function loadLocalTextBlacklists() {
    try {
        let tempIds = [];
        const directoryPath = __dirname;
        const files = fs.readdirSync(directoryPath);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        
        if (txtFiles.length === 0) {
            console.log('⚠️ No local .txt database files found in the directory.');
            return;
        }

        txtFiles.forEach(fileName => {
            const filePath = path.join(directoryPath, fileName);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const lines = content.split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !isNaN(line));
                
                tempIds = tempIds.concat(lines);
            } catch (err) {
                console.error(`❌ Error reading database file ${fileName}:`, err.message);
            }
        });

        BLACKLISTED_DISCORD_USERS = [...new Set(tempIds)];
        console.log(`✅ [SYNC] Database loaded successfully! Total unique blacklisted IDs: ${BLACKLISTED_DISCORD_USERS.length}`);

    } catch (error) {
        console.error('❌ Critical error scanning text directories:', error.message);
    }
}

// Register secure Global Slash Commands (100% English API definitions)
client.once('ready', async () => {
    console.log(`🤖 Global Security Shield is active as ${client.user.tag}!`);
    loadLocalTextBlacklists();

    try {
        const appId = client.application?.id || client.user?.id;
        if (!appId) throw new Error("Application ID is unavailable.");

        const commandData = [
            {
                name: 'scan',
                description: 'Scan the server using Roblox databases and local blacklist text files.'
            },
            {
                name: 'lockdown',
                description: 'Toggle total anti-raid lockdown mode for emergency protection.'
            },
            {
                name: 'verify',
                description: 'Enter the code from the generated image to unlock your account.',
                options: [
                    {
                        name: 'code',
                        description: 'Enter the exact text found in the verification image',
                        type: 3, // STRING Option Type
                        required: true
                    }
                ]
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Global slash commands (/scan, /lockdown, /verify) successfully synchronized with Discord API!');
    } catch (error) {
        console.error('❌ API Command registration failed:', error.message);
    }
});

function getRobloxUsername(member) {
    const customStatus = member.presence?.activities?.find(a => a.type === 4); 
    if (customStatus && customStatus.state) {
        return customStatus.state.trim();
    }
    return member.user.username;
}

// Comprehensive Security Check + Graphical Canvas CAPTCHA System (ALL IN ENGLISH)
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        if (LOCKDOWN_MODE && !isBulkScan) {
            await member.send(`🚨 This server is currently under emergency LOCKDOWN due to a cyber attack / raid. Please try again later.`).catch(() => null);
            await member.kick('Automated Anti-Raid: Server in Lockdown mode.').catch(() => null);
            return { status: 'banned', source: 'Anti-Raid' };
        }

        // 1. LOCAL BLACKLIST DATABASE TEXT SCAN (.TXT)
        if (BLACKLISTED_DISCORD_USERS.includes(member.id)) {
            await member.send(`⚠️ You have been automatically banned. Reason: Flagged in Global Security Blacklist Database.`).catch(() => null);
            await member.ban({ reason: 'Automated Security: Listed in blacklist text files.' }).catch(() => null);
            return { status: 'banned', source: 'Discord' };
        }

        // 2. ROBLOX CONDO GROUPS SECURE CHECK
        const robloxUsername = getRobloxUsername(member);
        const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [robloxUsername],
            excludeBannedUsers: false
        }).catch(() => null);

        if (userResponse && userResponse.data && userResponse.data.data.length > 0) {
            const robloxId = userResponse.data.data[0].id;
            const groupsResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`).catch(() => null);
            
            if (groupsResponse && groupsResponse.data && groupsResponse.data.data) {
                const userGroups = groupsResponse.data.data;
                let isInCondo = false;
                let flaggedGroupName = '';

                for (const group of userGroups) {
                    if (BLACKLISTED_ROBLOX_GROUPS.includes(group.group.id)) {
                        isInCondo = true;
                        flaggedGroupName = group.group.name;
                        break;
                    }
                }

                if (isInCondo) {
                    await member.send(`⚠️ You have been automatically banned for being a member of a flagged malicious group: ${flaggedGroupName}`).catch(() => null);
                    await member.ban({ reason: `Roblox Security: Flagged group association (${flaggedGroupName})` }).catch(() => null);
                    return { status: 'banned', source: 'Roblox', reason: flaggedGroupName };
                }
            }
        }

        // 3. GRAPHICAL CANVAS CAPTCHA EMISSION FOR HUMAN ACCOUNTS (ALL IN ENGLISH)
        if (targetChannel && !isBulkScan) {
            const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole).catch(() => null);
            }

            const captcha = new Captcha();
            captcha.async = true;
            captcha.addDecoy(); 
            captcha.drawTrace(); 
            captcha.drawCaptcha();

            userCaptchas.set(member.id, captcha.text);

            const attachment = new AttachmentBuilder(await captcha.png, { name: 'captcha.png' });

            await targetChannel.send({
                content: `🛡️ **Global Security Verification (Anti-Bot & Anti-Hijack)**\nWelcome ${member}! To protect this community from automated phishing attacks and raids, all accounts must complete this quick visual test.\n\n✍️ **Instructions:** Look at the image below and use the command \`/verify\` followed by the correct code to gain access.`,
                files: [attachment]
            }).catch(() => null);
        }

        return { status: 'safe' };

    } catch (error) {
        console.error("Security routine error:", error);
        return { status: 'error' };
    }
}

// 📥 EVENT: Anti-Raid Burst Detection on User Join
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; 

    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < RAID_INTERVAL);

    if (joinLog.length > RAID_THRESHOLD && !LOCKDOWN_MODE) {
        LOCKDOWN_MODE = true;
        let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === 0); // 0 = GuildText
        if (targetChannel) {
            await targetChannel.send(`🚨 **Automated Anti-Raid System Activated!** A burst of malicious joins has been detected. Server entries are now under **LOCKDOWN** status.`).catch(() => null);
        }
    }

    let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === 0);
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENT: Interaction Processing (Completely Protected from "Application Did Not Respond")
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
        // 1. THE MAIN /verify SLASH COMMAND HANDLER
        if (interaction.commandName === 'verify') {
            const codIntrodus = interaction.options.getString('code');
            const userId = interaction.user.id;

            if (!userCaptchas.has(userId)) {
                return interaction.reply({ content: '❌ You do not have an active security challenge to solve on this server.', ephemeral: true });
            }

            const codCorect = userCaptchas.get(userId);

            if (codIntrodus.toUpperCase() === codCorect.toUpperCase()) {
                userCaptchas.delete(userId); 

                const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
                const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

                if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
                if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

                return interaction.reply({ content: '✅ Verification successful! Your account has been authenticated. Welcome to the server!', ephemeral: true });
            } else {
                return interaction.reply({ content: '❌ Invalid code! Please read the image carefully and try the \`/verify\` command again.', ephemeral: true });
            }
        }

        // CHECK PERMISSIONS USING FORCED V14 SYNTAX
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Access Denied: Administrator permission is required to execute this command.', ephemeral: true });
        }

        // 2. THE /scan ROUTINE
        if (interaction.commandName === 'scan') {
            await interaction.deferReply();
            loadLocalTextBlacklists();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0, bannedCount = 0;

            for (const [id, member] of members) {
                if (member.user.bot) continue;
                const result = await performIndependentSecurityCheck(member, null, true); 
                if (result.status === 'safe') safeCount++;
                else if (result.status === 'banned') bannedCount++;
            }
            return interaction.editReply(`📊 **Security Scan Complete!**\n✅ Valid/Safe Accounts: ${safeCount}\n🔨 Malicious Accounts Purged (Blacklist/Roblox): ${bannedCount}`);
        }

        // 3. THE /lockdown ROUTINE
        if (interaction.commandName === 'lockdown') {
            LOCKDOWN_MODE = !LOCKDOWN_MODE;
            return interaction.reply(`🚨 **Emergency LOCKDOWN Status** has been changed to: **${LOCKDOWN_MODE ? 'ENABLED (New joins will be instantly kicked)' : 'DISABLED (Server returned to normal behavior)'}**.`);
        }

    } catch (error) {
        console.error('🔴 Critical Interaction Error Caught:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ An internal processing error occurred while executing this command.', ephemeral: true }).catch(() => null);
        } else if (interaction.deferred) {
            await interaction.editReply({ content: '❌ An internal processing error occurred while executing this command.' }).catch(() => null);
        }
    }
});

client.login(process.env.DISCORD_TOKEN);