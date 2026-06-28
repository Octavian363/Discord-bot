// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Scut Global Ultra-Securizat (Anti-Raid + Canvas CAPTCHA Grafic) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Serverul ruleaza pe portul ${port}.`);
});

// 3. Importurile complete din Discord, Captcha-Canvas, Axios și FS
const { 
    Client, 
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const { Captcha } = require('captcha-canvas');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Activăm structura completă de Intents (inclusiv pentru citirea statusurilor membrilor)
const client = new Client({
    intents: [1, 2, 512, 256] // Guilds, GuildMembers, GuildMessages, GuildPresences
});

// 🛡️ CONFIGURARE ROLURI PENTRU ACCES (Pune ID-urile reale din serverul tău aici)
const ROL_UNVERIFIED_ID = 'ID_ROL_NEVERIFICAT'; // Rol restrictiv primit la intrare
const ROL_VERIFIED_ID = 'ID_ROL_VERIFICAT';     // Rolul general de acces primit după CAPTCHA

// Dicționar în memorie pentru a salva codurile CAPTCHA generate (User ID -> Text Cod)
const userCaptchas = new Map();

// 🛑 SISTEM AUTOMAT ANTI-RAID (Protecție Crypto/NFT/Twitch)
let joinLog = []; 
const RAID_THRESHOLD = 5; 
const RAID_INTERVAL = 3000; 
let LOCKDOWN_MODE = false; 

// 🛡️ Baza ta de date fixă cu ID-uri Condo de pe ROBLOX
const BLACKLISTED_ROBLOX_GROUPS = [
    33245612, 16482991, 15900234, 32441109, 17234901, 11400562, 34001922,
    15501928, 32991023, 12004958, 16772019, 33110294, 14920193, 11002938,
    10992384, 33456129, 15110293, 16220394, 32881029, 14772019, 12334950,
    33881029, 15440293, 16992039, 32110293, 14220394, 11882938, 33661029,
    1234567, 89101112, 5544332, 9988776, 4455667, 2233445, 7766554, 1122334
]; 

// Memorie cache dinamică pentru ID-urile de Discord extrase din fișierele tale .txt
let BLACKLISTED_DISCORD_USERS = [];

function loadLocalTextBlacklists() {
    try {
        let tempIds = [];
        const directoryPath = __dirname;
        const files = fs.readdirSync(directoryPath);
        const txtFiles = files.filter(file => path.extname(file).toLowerCase() === '.txt');
        
        if (txtFiles.length === 0) {
            console.log('⚠️ Nu s-a găsit niciun fișier .txt în folderul principal.');
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
                console.error(`❌ Eroare la citirea fișierului ${fileName}:`, err.message);
            }
        });

        BLACKLISTED_DISCORD_USERS = [...new Set(tempIds)];
        console.log(`✅ [SINC] Încărcare completă! Total ID-uri Discord unice: ${BLACKLISTED_DISCORD_USERS.length}`);

    } catch (error) {
        console.error('❌ Eroare gravă la scanarea directoarelor:', error.message);
    }
}

// Înregistrarea securizată a tuturor comenzilor Slash globale (Scurtate sub limită)
client.once('ready', async () => {
    console.log(`🤖 Scutul Global Integrat este activ ca ${client.user.tag}!`);
    loadLocalTextBlacklists();

    try {
        const appId = client.application?.id || client.user?.id;
        if (!appId) throw new Error("ID-ul aplicatiei indisponibil.");

        const commandData = [
            {
                name: 'scan',
                description: 'Scaneaza serverul folosind listele Roblox si ID-urile din fisierele text.'
            },
            {
                name: 'lockdown',
                description: 'Activeaza/Dezactiveaza manual protectia totala impotriva raidurilor masive.'
            },
            {
                name: 'verifica',
                description: 'Introdu codul CAPTCHA primit din imagine pentru deblocarea contului.',
                options: [
                    {
                        name: 'cod',
                        description: 'Introdu exact codul text gasit in imaginea generata',
                        type: 3, // STRING
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
        console.log('✅ Toate comenzile globale (/scan, /lockdown, /verifica) au fost înregistrate cu succes!');
    } catch (error) {
        console.error('❌ Eroare la înregistrarea API:', error.message);
    }
});

function getRobloxUsername(member) {
    const customStatus = member.presence?.activities?.find(a => a.type === 4); 
    if (customStatus && customStatus.state) {
        return customStatus.state.trim();
    }
    return member.user.username;
}

// Verificare securitate + Generare CAPTCHA Canvas Grafic obligatoriu pentru toți oamenii
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        if (LOCKDOWN_MODE && !isBulkScan) {
            await member.send(`🚨 Serverul este securizat sub regim LOCKDOWN din cauza unui raid. Incearca mai tarziu.`).catch(() => null);
            await member.kick('Sistem Automat Anti-Raid: Server în Lockdown.').catch(() => null);
            return { status: 'banned', source: 'Anti-Raid' };
        }

        // 1. VERIFICARE FIȘIERE TEXT (.TXT)
        if (BLACKLISTED_DISCORD_USERS.includes(member.id)) {
            await member.send(`⚠️ Ai fost banat automat. Motiv: Bază de date Blacklist locală.`).catch(() => null);
            await member.ban({ reason: 'Securitate Automată: ID listat în fișierele text.' }).catch(() => null);
            return { status: 'banned', source: 'Discord' };
        }

        // 2. VERIFICARE ROBLOX CONDO GROUPS
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
                    await member.send(`⚠️ Ai fost eliminat automat deoarece ești membru în grupul Condo: ${flaggedGroupName}`).catch(() => null);
                    await member.ban({ reason: `Securitate Roblox: Grupul virusat (${flaggedGroupName})` }).catch(() => null);
                    return { status: 'banned', source: 'Roblox', reason: flaggedGroupName };
                }
            }
        }

        // 3. GENERARE CAPTCHA CANVAS GRAFIC (Pentru toți oamenii, inclusiv Admini la intrare)
        if (targetChannel && !isBulkScan) {
            const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            if (unverifiedRole) {
                await member.roles.add(unverifiedRole).catch(() => null);
            }

            // Inițializăm și configurăm imaginea securizată cu pachetul captcha-canvas
            const captcha = new Captcha();
            captcha.async = true;
            captcha.addDecoy(); // Linii de fundal anti-boți
            captcha.drawTrace(); // Amprentă de zgomot grafic
            captcha.drawCaptcha();

            // Salvăm stringul generat în Map-ul nostru securizat (User ID -> Textul corect)
            userCaptchas.set(member.id, captcha.text);

            // Convertim bufferul imaginii într-un fișier atașat de Discord
            const attachment = new AttachmentBuilder(await captcha.png, { name: 'captcha.png' });

            // Trimitem imaginea direct pe canalul de înregistrare al serverului
            await targetChannel.send({
                content: `🛡️ **Sistem Global Anti-Bot & Anti-Hijack**\nBun venit ${member}! Toate conturile (utilizatori, moderatori și administratori) trebuie să completeze verificarea vizuală pentru a debloca serverul.\n\n✍️ **Instrucțiuni:** Privește imaginea de mai jos și folosește comanda globală \`/verifica\` urmată de codul corect.`,
                files: [attachment]
            }).catch(() => null);
        }

        return { status: 'safe' };

    } catch (error) {
        console.error("Eroare la procesarea securitatii:", error);
        return { status: 'error' };
    }
}

// 📥 EVENIMENT: Detecție Automated Raids la intrarea membrilor umani
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; // Ignorăm complet boții autorizați

    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < RAID_INTERVAL);

    if (joinLog.length > RAID_THRESHOLD && !LOCKDOWN_MODE) {
        LOCKDOWN_MODE = true;
        let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        if (targetChannel) {
            await targetChannel.send(`🚨 **Sistemul a activat LOCKDOWN!** Detectat un posibil raid masiv de boți. Porțile serverului sunt închise.`);
        }
    }

    let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENIMENT: Interacțiuni (Comenzi Slash complete)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand?.() && !interaction.isCommand?.()) return;

    // 1. PROTOCOLUL /verifica (Răspunsul la CAPTCHA grafic)
    if (interaction.commandName === 'verifica') {
        const codIntrodus = interaction.options.getString('cod');
        const userId = interaction.user.id;

        // Verificăm dacă userul are un cod activ alocat în cache
        if (!userCaptchas.has(userId)) {
            return interaction.reply({ content: '❌ Nu deții un test CAPTCHA activ de rezolvat pe acest server.', ephemeral: true });
        }

        const codCorect = userCaptchas.get(userId);

        // Verificare Case-Insensitive (Nu contează literele mari/mici)
        if (codIntrodus.toUpperCase() === codCorect.toUpperCase()) {
            userCaptchas.delete(userId); // Curățăm cache-ul din memorie pentru siguranță

            try {
                const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
                const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

                // Schimbăm rolurile securizat (.catch previne erori dacă userul e admin nativ)
                if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
                if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

                return interaction.reply({ content: '✅ Verificare reușită! Identitatea ta a fost confirmată. Ai primit acces pe server.', ephemeral: true });
            } catch (err) {
                return interaction.reply({ content: '❌ Eroare de ierarhie la alocarea rolului. Contactează de urgență un Admin.', ephemeral: true });
            }
        } else {
            return interaction.reply({ content: '❌ Cod incorect! Privește cu atenție imaginea și reîncearcă comanda \`/verifica\`.', ephemeral: true });
        }
    }

    // VERIFICARE PERMISIUNI ADMINISTRATIVE PENTRU /scan ȘI /lockdown
    if (!interaction.member.permissions.has('ADMINISTRATOR')) {
        return interaction.reply({ content: '❌ Doar un Administrator autorizat poate rula această comandă de control.', ephemeral: true });
    }

    // 2. PROTOCOLUL /scan
    if (interaction.commandName === 'scan') {
        await interaction.deferReply();
        loadLocalTextBlacklists();
        const members = await interaction.guild.members.fetch();
        let safeCount = 0, bannedCount = 0;

        await interaction.editReply(`🔄 Se execută scanarea structurală pe ${members.size} conturi active...`);

        for (const [id, member] of members) {
            if (member.user.bot) continue;
            const result = await performIndependentSecurityCheck(member, null, true); 
            if (result.status === 'safe') safeCount++;
            else if (result.status === 'banned') bannedCount++;
        }
        await interaction.editReply(`📊 **Scanare structurală completă!**\n✅ Conturi sigure: ${safeCount}\n🔨 Eliminări automate din baza de date: ${bannedCount}`);
    }

    // 3. PROTOCOLUL /lockdown
    if (interaction.commandName === 'lockdown') {
        LOCKDOWN_MODE = !LOCKDOWN_MODE;
        return interaction.reply(`🚨 **Regimul LOCKDOWN** a fost setat pe: **${LOCKDOWN_MODE ? 'ACTIVAT (Membrii noi primesc kick instant)' : 'DEZACTIVAT (Serverul funcționează normal)'}**.`);
    }
});

client.login(process.env.DISCORD_TOKEN);