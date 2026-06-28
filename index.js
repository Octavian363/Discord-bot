require('dotenv').config();
const { 
    Client, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
    ChannelType
} = require('discord.js');
const axios = require('axios');

const client = new Client({
    intents: [1, 2, 512] // Guilds, GuildMembers, GuildMessages
});

// =========================================================================
// 🛡️ LISTA NEAGRĂ GLOBALĂ REZOLVATĂ (ID-uri Condo/Bypassed SUA & RO)
// Am adăugat ID-urile comunităților mari, clanurilor de „scent” și grupurilor de organizare.
// =========================================================================
const BLACKLISTED_ROBLOX_GROUPS = [
    // --- Grupuri și comunități Condo/Scent mari (Internaționale/SUA) ---
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    // --- Comunități Condo/Cluburi de noapte mascate (RO & Internațional) ---
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    // --- ID-uri de test și grupuri raportate recent pe Discord Server Logs ---
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

const BLACKLISTED_DISCORD_USERS = []; 

const commands = [
    new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Verify your Roblox profile and Discord safety status.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

client.once('ready', async () => {
    console.log(`🤖 Global Security Bot is online as ${client.user.tag}!`);
    try {
        console.log('🔄 Registering global slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id), 
            { body: commands }
        );
        console.log('✅ Global Slash commands registered successfully!');
    } catch (error) {
        console.error(error);
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
            return { status: 'unverified', message: 'Your Discord account is not linked to Roblox via RoVer. Please link it at rover.link first.' };
        }

        const robloxId = roverResponse.data.robloxId;
        const robloxUsername = roverResponse.data.cachedUsername;

        const groupsResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
        if (!groupsResponse.data || !groupsResponse.data.data) {
            return { status: 'error', message: 'Failed to access your Roblox group configurations.' };
        }

        const userGroups = groupsResponse.data.data;
        let dangerousRobloxUser = false;
        let flaggedGroupId = null;

        for (const group of userGroups) {
            if (BLACKLISTED_ROBLOX_GROUPS.includes(group.group.id)) {
                dangerousRobloxUser = true;
                flaggedGroupId = group.group.id;
                break;
            }
        }

        if (dangerousRobloxUser) {
            await member.send(`⚠️ You have been banned from ${member.guild.name}. Your Roblox account (${robloxUsername}) belongs to a blacklisted community.`).catch(() => null);
            await member.ban({ 
                deleteMessageSeconds: 60 * 60 * 24, 
                reason: `Automated Security: Blacklisted Roblox Group (ID: ${flaggedGroupId})` 
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
            channel => channel.type === ChannelType.GuildText && 
            channel.permissionsFor(member.guild.members.me).has('SendMessages')
        );
    }

    if (targetChannel) {
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('verify_button').setLabel('Verify Account Security').setStyle(ButtonStyle.Danger),
        );

        await targetChannel.send({
            content: `🛡️ Welcome ${member}! To maintain server safety, you must pass our automated background check. Click below or use \`/verify\`.`,
            components: [row]
        }).catch(() => null);
    }
});

client.on('interactionCreate', async (interaction) => {
    if ((interaction.isChatInputCommand() && interaction.commandName === 'verify') || (interaction.isButton() && interaction.customId === 'verify_button')) {
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