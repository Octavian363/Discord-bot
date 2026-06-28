// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Botul de securitate independent este online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Serverul de mentinere activa ruleaza pe portul ${port}.`);
});

// 3. Importurile pentru Discord și restul bibliotecilor
const { 
    Client, 
    ChannelType
} = require('discord.js');
const axios = require('axios');

// Activăm și Presence Intent (7) pentru a putea citi statusul utilizatorilor
const client = new Client({
    intents: [1, 2, 512, 256] // Guilds, GuildMembers, GuildMessages, GuildPresences
});

// 🛡️ Baza ta de date cu ID-uri fixe Condo
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

// Înregistrare comanda /scan prin Axios direct în Discord API
client.once('ready', async () => {
    console.log(`🤖 Global Security Bot is online as ${client.user.tag}!`);
    try {
        console.log('🔄 Registering global slash commands via HTTP API...');
        const commandData = [
            {
                name: 'scan',
                description: 'Scaneaza toti membrii serverului impotriva listei de grupuri Condo.'
            }
        ];
        await axios.put(
            `https://discord.com/api/v10/applications/${client.user.id}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Global Slash commands (/scan) registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error.message);
    }
});

// Funcție care încearcă să afle numele de Roblox (din status sau din username-ul de Discord)
function getRobloxUsername(member) {
    const customStatus = member.presence?.activities?.find(a => a.type === 4); 
    if (customStatus && customStatus.state) {
        return customStatus.state.trim();
    }
    return member.user.username;
}

// Funcția principală care verifică grupurile de Roblox direct prin API-ul oficial Roblox
async function checkRobloxUserIndependent(robloxUsername, member, targetChannel = null, isBulkScan = false) {
    try {
        const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [robloxUsername],
            excludeBannedUsers: false
        });

        if (!userResponse.data || !userResponse.data.data.length) {
            return { status: 'not_found' };
        }

        const robloxId = userResponse.data.data[0].id;

        const groupsResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
        if (!groupsResponse.data || !groupsResponse.data.data) {
            return { status: 'error' };
        }

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
            // Trimite mesajul privat exact așa cum ai cerut
            await member.send(`⚠️ ${member.user.username} you have been banned from the group ${flaggedGroupName}`).catch(() => null);
            // Execută ban-ul pe Discord
            await member.ban({ reason: `Independent Security: Membru in grupul Condo listat (${flaggedGroupName})` }).catch(() => null);
            return { status: 'banned', groupName: flaggedGroupName };
        } else {
            // Trimitem mesaj normal pe chat DOAR dacă e intrare de membru nou (la scanarea generală nu facem spam)
            if (targetChannel && !isBulkScan) {
                await targetChannel.send(`✅ ${member.user.username} your account is safe`).catch(() => null);
            }
            return { status: 'safe' };
        }

    } catch (error) {
        return { status: 'error' };
    }
}

// 📥 EVENIMENT: Când un membru nou intră pe server (Scanare automată)
client.on('guildMemberAdd', async (member) => {
    const robloxName = getRobloxUsername(member);
    
    let targetChannel = member.guild.systemChannel;
    if (!targetChannel) {
        targetChannel = member.guild.channels.cache.find(
            channel => channel.type === ChannelType.GuildText || channel.type === 'GUILD_TEXT'
        );
    }

    await checkRobloxUserIndependent(robloxName, member, targetChannel, false);
});

// 🚀 EVENIMENT: Executarea comenzii globale /scan (Mesaje întregi, vizibile de toți)
client.on('interactionCreate', async (interaction) => {
    const isSlashCommand = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.isCommand && interaction.isCommand());
    if (!isSlashCommand) return;

    if (interaction.commandName === 'scan') {
        // Am eliminat complet { ephemeral: true } ca să fie un mesaj normal, întreg pe chat
        await interaction.deferReply(); 

        if (!interaction.member.permissions.has('ADMINISTRATOR') && !interaction.member.permissions.has('Administrator')) {
            return interaction.editReply('❌ Nu ai permisiunea de Administrator pentru a scana serverul.');
        }

        // Luăm canalul de text unde s-a dat comanda
        const channel = interaction.channel;

        const members = await interaction.guild.members.fetch();
        let safeCount = 0;
        let bannedCount = 0;

        await interaction.editReply(`🔄 Se începe scanarea serverului pentru toți cei ${members.size} membri...`);

        for (const [id, member] of members) {
            if (member.user.bot) continue;

            const robloxName = getRobloxUsername(member);
            // Activam flag-ul true ca sa stie ca e scanare generala si sa nu umple chatul cu "your account is safe" pentru fiecare om
            const result = await checkRobloxUserIndependent(robloxName, member, channel, true); 

            if (result.status === 'safe') {
                safeCount++;
            } else if (result.status === 'banned') {
                bannedCount++;
            }
        }

        // Trimitem raportul final ca mesaj întreg pe canal, vizibil pentru toți
        await interaction.editReply(`📊 **Scanare completă!** Toți membrii au fost analizați.\n✅ Conturi sigure: ${safeCount}\n🔨 Conturi periculoase eliminate: ${bannedCount}`).catch(() => null);
    }
});

client.login(process.env.DISCORD_TOKEN);