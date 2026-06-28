require('dotenv').config();
const { 
    Client, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ChannelType
} = require('discord.js');
const axios = require('axios');

// Intents ca numere brute pentru compatibilitate 100% v13/v14
const client = new Client({
    intents: [1, 2, 512] // Guilds, GuildMembers, GuildMessages
});

// 🛡️ Baza de date cu ID-uri fixe Condo (SUA + RO)
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

// 🚫 Cuvinte cheie extinse la maximum pentru a prinde TOATE condourile (România + SUA)
const CONDO_KEYWORDS = [
    'condo', 'scent', 'bypassed clothing', 'bypassed shirt', 'bypassed pants',
    'scent clan', 'ruined club', 'undressed', 'cl0thing', 'bypass', '18+', 'nsfw roblox',
    'scent community', 'bypassed attire', 'vibe condo', 'condos', 'scents', 'strip club', 
    'bypassed', 'baepassed', 'unbypassed', '18+ club'
];

const BLACKLISTED_DISCORD_USERS = []; 

// Înregistrare comenzi prin Axios (Evită REST și erorile de versiune din discord.js)
client.once('ready', async () => {
    console.log(`🤖 Global Security Bot is online as ${client.user.tag}!`);
    try {
        console.log('🔄 Registering global slash commands via HTTP API...');
        
        const commandData = [
            {
                name: 'scan',
                description: 'Scan your Roblox account to ensure compliance with community safety rules.'
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${client.user.id}/commands`,
            commandData,
            {
                headers: {
                    Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Global Slash commands (/scan) registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error.response ? error.response.data : error.message);
    }
});

async function performDualSecurityCheck(member) {
    try {
        if (BLACKLISTED_DISCORD_USERS.includes(member.id)) {
            await member.send(`⚠️ You are globally blacklisted from ${member.guild.name}.`).catch(() => null);
            await member.ban({ reason: 'Global Blacklist: Dangerous User Asset.' });
            return { status: 'banned' };
        }

        const roverResponse = await axios.get(`https://api.rover.link/v1/users/${member.id}`).catch(() => null);
        if (!roverResponse || !roverResponse.data || !roverResponse.data.robloxId) {
            return { status: 'unverified', message: 'Your Discord account is not linked to Roblox via RoVer. Please link your account at https://rover.link/ first.' };
        }

        const robloxId = roverResponse.data.robloxId;
        const robloxUsername = roverResponse.data.cachedUsername;

        const groupsResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
        if (!groupsResponse.data || !groupsResponse.data.data) {
            return { status: 'error', message: 'Failed to access your Roblox group configurations.' };
        }

        const userGroups = groupsResponse.data.data;
        let dangerousRobloxUser = false;
        let flaggedReason = '';

        for (const group of userGroups) {
            const groupName = group.group.name.toLowerCase();
            const groupId = group.group.id;

            if (BLACKLISTED_ROBLOX_GROUPS.includes(groupId)) {
                dangerousRobloxUser = true;
                flaggedReason = `Blacklisted ID: ${groupId}`;
                break;
            }

            const match = CONDO_KEYWORDS.find(keyword => groupName.includes(keyword));
            if (match) {
                dangerousRobloxUser = true;
                flaggedReason = `Detected Condo Keyword (${match}) in group: "${group.group.name}"`;
                break;
            }
        }

        if (dangerousRobloxUser) {
            await member.send(`⚠️ You have been banned from ${member.guild.name}. Your Roblox account (${robloxUsername}) belongs to a blacklisted condo/bypassed community.`).catch(() => null);
            await member.ban({ 
                deleteMessageSeconds: 60 * 60 * 24, 
                reason: `Automated Security: ${flaggedReason}` 
            });
            
            if (!BLACKLISTED_DISCORD_USERS.includes(member.id)) {
                BLACKLISTED_DISCORD_USERS.push(member.id);
            }
            return { status: 'banned' };
        }

        return { status: 'safe', username: robloxUsername };

    } catch (error) {
        return { status: 'error', message: 'An error occurred during verification.' };
    }
}

client.on('guildMemberAdd', async (member) => {
    const result = await performDualSecurityCheck(member);
    if (result.status === 'banned') return;

    let targetChannel = member.guild.systemChannel;

    if (!targetChannel) {
        targetChannel = member.guild.channels.cache.find(
            channel => channel.type === ChannelType.GuildText || channel.type === 'GUILD_TEXT'
        );
    }

    if (targetChannel) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('scan_button').setLabel('Run Security Scan').setStyle(ButtonStyle.Success || 'SUCCESS'),
        );

        await targetChannel.send({
            content: `🛡️ Welcome ${member}! To maintain server safety, you must complete a quick security check. Click below or use \`/scan\`.`,
            components: [row]
        }).catch(() => null);
    }
});

client.on('interactionCreate', async (interaction) => {
    const isCommand = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.isCommand && interaction.isCommand());
    const isButton = interaction.isButton ? interaction.isButton() : interaction.componentType === 'BUTTON';

    if ((isCommand && interaction.commandName === 'scan') || (isButton && interaction.customId === 'scan_button')) {
        
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const result = await performDualSecurityCheck(member);

        if (result.status === 'banned') return;
        
        if (result.status === 'unverified') {
            await interaction.editReply({ content: `❌ ${result.message}` });
        } else if (result.status === 'error') {
            await interaction.editReply({ content: `⚠️ ${result.message}` });
        } else if (result.status === 'safe') {
            await interaction.editReply({ content: `✅ **Clear!** Your Discord account and Roblox profile (**${result.username}**) have passed all security protocols. Access granted.` });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);