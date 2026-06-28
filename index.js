// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Botul de securitate independent (Roblox + Folder .TXT) este online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Serverul de mentinere activa ruleaza pe portul ${port}.`);
});

// 3. Importurile pentru Discord, Axios și Sistemul de Fișiere (fs)
const { 
    Client, 
    ChannelType
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Activăm și Presence Intent pentru a putea citi statusul utilizatorilor
const client = new Client({
    intents: [1, 2, 512, 256] // Guilds, GuildMembers, GuildMessages, GuildPresences
});

// 🛡️ Baza ta de date fixă cu ID-uri Condo de pe ROBLOX păstrată intactă
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

// Memorie cache dinamică pentru ID-urile de Discord extrase din fișierele .txt
let BLACKLISTED_DISCORD_USERS = [];

// Funcție inteligentă care scanează folderul botului și citește automat TOATE fișierele .txt
function loadLocalTextBlacklists() {
    try {
        let tempIds = [];
        const directoryPath = __dirname;
        
        // Citim toate fișierele din folderul principal al botului
        const files = fs.readdirSync(directoryPath);
        
        // Filtrăm doar fișierele care se termină în .txt
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        
        if (txtFiles.length === 0) {
            console.log('⚠️ Nu s-a găsit niciun fișier .txt în folderul principal.');
            return;
        }

        txtFiles.forEach(fileName => {
            const filePath = path.join(directoryPath, fileName);
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                // Împărțim textul pe linii, curățăm caracterele invizibile gen \r și ignorăm liniile care nu sunt numere
                const lines = content.split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(line => line.length > 0 && !isNaN(line));
                
                tempIds = tempIds.concat(lines);
                console.log(`📁 S-au extras ${lines.length} ID-uri din fișierul local: ${fileName}`);
            } catch (err) {
                console.error(`❌ Eroare la citirea fișierului ${fileName}:`, err.message);
            }
        });

        // Eliminăm duplicatele pentru a optimiza memoria botului
        BLACKLISTED_DISCORD_USERS = [...new Set(tempIds)];
        console.log(`✅ [SINC] Încărcare completă! Total ID-uri Discord unice în baza locală: ${BLACKLISTED_DISCORD_USERS.length}`);

    } catch (error) {
        console.error('❌ Eroare gravă la scanarea directoarelor pentru fișiere text:', error.message);
    }
}

// Înregistrare comenzi Discord la pornirea aplicației
client.once('ready', async () => {
    console.log(`🤖 Global Security Bot is online as ${client.user.tag}!`);
    
    // Încărcăm fișierele text imediat ce botul rulează
    loadLocalTextBlacklists();

    try {
        console.log('🔄 Registering global slash commands via HTTP API...');
        const commandData = [
            {
                name: 'scan',
                description: 'Scaneaza toti membrii comunitatii comparand profilul cu listele Roblox si ID-urile din fisierele .txt.'
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

// Extragere asincronă a numelui de Roblox din status sau din profilul Discord
function getRobloxUsername(member) {
    const customStatus = member.presence?.activities?.find(a => a.type === 4); 
    if (customStatus && customStatus.state) {
        return customStatus.state.trim();
    }
    return member.user.username;
}

// Funcția centralizată de verificare a securității independente
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        // 1. SECURITATE DISCORD (Din fișierele tale text încărcate)
        if (BLACKLISTED_DISCORD_USERS.includes(member.id)) {
            // Trimitem mesajul privat
            await member.send(`⚠️ ${member.user.username} you have been banned from this server. Reason: Flagged in Blacklist Database.`).catch(() => null);
            // Aplicăm ban-ul direct pe Discord
            await member.ban({ reason: 'Independent Security: Utilizator listat în fișierele text (.txt).' }).catch(() => null);
            return { status: 'banned', source: 'Discord' };
        }

        // 2. SECURITATE ROBLOX (Din lista fixă de ID-uri)
        const robloxUsername = getRobloxUsername(member);
        const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [robloxUsername],
            excludeBannedUsers: false
        });

        if (!userResponse.data || !userResponse.data.data.length) {
            return { status: 'safe' };
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

        // 3. EXECUTARE ACȚIUNI
        if (isInCondo) {
            await member.send(`⚠️ ${member.user.username} you have been banned from the group ${flaggedGroupName}`).catch(() => null);
            await member.ban({ reason: `Independent Security: Membru Roblox în grupul Condo listat (${flaggedGroupName})` }).catch(() => null);
            return { status: 'banned', source: 'Roblox', reason: flaggedGroupName };
        } else {
            // Trimitem mesaj pe canal doar la intrările de membri noi (la /scan general nu aglomerăm chat-ul)
            if (targetChannel && !isBulkScan) {
                await targetChannel.send(`✅ ${member.user.username} your account is safe`).catch(() => null);
            }
            return { status: 'safe' };
        }

    } catch (error) {
        return { status: 'error' };
    }
}

// 📥 EVENIMENT AUTOMAT: Declanșat la intrarea unui utilizator nou pe server
client.on('guildMemberAdd', async (member) => {
    let targetChannel = member.guild.systemChannel;
    if (!targetChannel) {
        targetChannel = member.guild.channels.cache.find(
            channel => channel.type === ChannelType.GuildText || channel.type === 'GUILD_TEXT'
        );
    }
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENIMENT MANUAL: Executarea comenzii `/scan` pentru tot serverul (Mesaj normal pe chat)
client.on('interactionCreate', async (interaction) => {
    const isSlashCommand = interaction.isChatInputCommand ? interaction.isChatInputCommand() : (interaction.isCommand && interaction.isCommand());
    if (!isSlashCommand) return;

    if (interaction.commandName === 'scan') {
        await interaction.deferReply(); 

        if (!interaction.member.permissions.has('ADMINISTRATOR') && !interaction.member.permissions.has('Administrator')) {
            return interaction.editReply('❌ Nu ai permisiunea de Administrator pentru a utiliza această comandă.');
        }

        // Reîncărcăm fișierele text dinamice chiar în momentul scanării, în caz că ai adăugat/șters ID-uri între timp
        loadLocalTextBlacklists();

        const channel = interaction.channel;
        const members = await interaction.guild.members.fetch();
        let safeCount = 0;
        let bannedCount = 0;

        await interaction.editReply(`🔄 Se începe scanarea completă pentru cei ${members.size} membri utilizând listele Roblox și fișierele text...`);

        for (const [id, member] of members) {
            if (member.user.bot) continue;

            const result = await performIndependentSecurityCheck(member, channel, true); 

            if (result.status === 'safe') {
                safeCount++;
            } else if (result.status === 'banned') {
                bannedCount++;
            }
        }

        await interaction.editReply(`📊 **Scanare structurală finalizată!**\n✅ Utilizatori declarați siguri: ${safeCount}\n🔨 Utilizatori periculoși eliminați de pe server: ${bannedCount}`).catch(() => null);
    }
});

client.login(process.env.DISCORD_TOKEN);