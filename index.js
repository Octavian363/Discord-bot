// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Scut de Securitate Ultra-Securizat (Crypto/NFT/Twitch Anti-Raid) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Serverul ruleaza pe portul ${port}.`);
});

// 3. Importurile pentru Discord, Axios și Sistemul de Fișiere (fs)
const { 
    Client, 
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
} = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Activăm și Presence Intent pentru a putea citi statusul utilizatorilor
const client = new Client({
    intents: [1, 2, 512, 256] // Guilds, GuildMembers, GuildMessages, GuildPresences
});

// 🛡️ CONFIGURARE ROLURI PENTRU CAPTCHA (Pune ID-urile reale din serverul tău aici)
const ROL_UNVERIFIED_ID = 'ID_ROL_NEVERIFICAT'; // Rol restrictiv (fără permisiuni de citire canale)
const ROL_VERIFIED_ID = 'ID_ROL_VERIFICAT';     // Rol primit după ce trece CAPTCHA

// 🛑 SISTEM AUTOMAT ANTI-RAID (Setări de siguranță pentru Crypto/NFT/Twitch)
let joinLog = []; // Memorie cache pentru monitorizarea intrărilor
const RAID_THRESHOLD = 5; // Câți membri au voie să intre...
const RAID_INTERVAL = 3000; // ...în câte milisecunde (3000ms = 3 secunde)
let LOCKDOWN_MODE = false; // Dacă devine 'true', botul dă kick/ban automat la tot ce intră în timpul raidului

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

// Funcție inteligentă de citire a fișierelor text locale
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
        console.error('❌ Eroare gravă la scanarea directoarelor pentru fișiere text:', error.message);
    }
}

// Pornirea botului și securizarea API-ului
client.once('ready', async () => {
    console.log(`🤖 Scutul de Securitate este activ ca ${client.user.tag}!`);
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
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Comenzile globale (/scan, /lockdown) au fost securizate și înregistrate!');
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

// Centralizator Securitate + Logica de Scanare & CAPTCHA
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        // [ULTRA SAFE] Protecție împotriva atacurilor de tip Raid activat (Lockdown)
        if (LOCKDOWN_MODE && !isBulkScan) {
            await member.send(`🚨 Serverul este momentan securizat sub regim LOCKDOWN din cauza unui atac cibernetic / raid. Reîncearcă mai târziu.`).catch(() => null);
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

        // 3. GENERARE CAPTCHA PENTRU UTILIZATORII CURAȚI
        if (targetChannel && !isBulkScan) {
            const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_captcha_button')
                    .setLabel('Verificare Umană (Anti-Bot) 🔓')
                    .setStyle(ButtonStyle.Success)
            );

            await targetChannel.send({
                content: `🛡️ Bun venit ${member}! Contul tău a fost scanat și este curat.\n**Pentru a preveni boții de phishing/crypto raid, apasă pe butonul de mai jos pentru a primi acces.**`,
                components: [row]
            }).catch(() => null);
        }

        return { status: 'safe' };

    } catch (error) {
        return { status: 'error' };
    }
}

// 📥 EVENIMENT: Detectare Automated Raids la intrarea membrilor
client.on('guildMemberAdd', async (member) => {
    const now = Date.now();
    joinLog.push(now);

    // Curățăm logurile mai vechi decât intervalul setat
    joinLog = joinLog.filter(time => now - time < RAID_INTERVAL);

    // [ANTI-RAID TRIGGER] Dacă intră mai mulți boți simultan
    if (joinLog.length > RAID_THRESHOLD && !LOCKDOWN_MODE) {
        LOCKDOWN_MODE = true;
        console.log(`🚨 [ALERTĂ SEC] Detectat atac cibernetic automat de tip RAID! Modul LOCKDOWN a fost activat.`);
        
        let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        if (targetChannel) {
            await targetChannel.send(`🚨 **Sistemul de Securitate a detectat un Automated Raid!** Serverul a intrat în modul **LOCKDOWN** (Intrările noi sunt blocate automat pentru siguranța serverului NFT/Crypto).`).catch(() => null);
        }
    }

    let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENIMENT: Interacțiuni securizate (Comenzi Slash + Butoane)
client.on('interactionCreate', async (interaction) => {
    // A. EXECUTARE ARTIFACTE COMANDĂ
    if (interaction.isChatInputCommand?.() || interaction.isCommand?.()) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ Doar un Administrator poate rula protocoalele de securitate.', ephemeral: true });
        }

        // 1. COMANDA /scan
        if (interaction.commandName === 'scan') {
            await interaction.deferReply();
            loadLocalTextBlacklists();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0, bannedCount = 0;

            await interaction.editReply(`🔄 Se execută scanarea structurală pe ${members.size} conturi...`);

            for (const [id, member] of members) {
                if (member.user.bot) continue;
                const result = await performIndependentSecurityCheck(member, null, true); 
                if (result.status === 'safe') safeCount++;
                else if (result.status === 'banned') bannedCount++;
            }
            await interaction.editReply(`📊 **Scanare completă!**\n✅ Conturi sigure: ${safeCount}\n🔨 Eliminări imediate (Blacklist/Roblox): ${bannedCount}`);
        }

        // 2. COMANDA /lockdown (Manuală pentru urgențe în serverele de Crypto/NFT)
        if (interaction.commandName === 'lockdown') {
            LOCKDOWN_MODE = !LOCKDOWN_MODE;
            return interaction.reply(`🚨 **Modul LOCKDOWN (Anti-Raid)** a fost schimbat în: **${LOCKDOWN_MODE ? 'ACTIVAT (Serverul este complet blocat pentru membrii noi)' : 'DEZACTIVAT (Serverul a revenit la normal)'}**.`);
        }
        return;
    }

    // B. PROCESARE NATIVĂ BUTON CAPTCHA (ZERO EXP-HOLE)
    if (interaction.isButton() && interaction.customId === 'verify_captcha_button') {
        const member = interaction.member;

        if (!member.roles.cache.has(ROL_UNVERIFIED_ID)) {
            return interaction.reply({ content: '❌ Profilul tău deține deja acces sau verificarea a expirat.', ephemeral: true });
        }

        try {
            const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

            if (unverifiedRole) await member.roles.remove(unverifiedRole);
            if (verifiedRole) await member.roles.add(verifiedRole);

            await interaction.reply({ content: '✅ Verificare completă! Ai primit acces securizat pe server.', ephemeral: true });
            await interaction.message.delete().catch(() => null);

        } catch (err) {
            await interaction.reply({ content: '❌ Eroare de rețea internă Discord la alocarea rolului.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);