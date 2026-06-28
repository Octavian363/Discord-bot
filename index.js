// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Scut de Securitate Global (CAPTCHA Obligatoriu pentru Toti Oamenii) Online!\n');
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
const ROL_UNVERIFIED_ID = 'ID_ROL_NEVERIFICAT'; // Rol restrictiv primit la intrare (opțional)
const ROL_VERIFIED_ID = 'ID_ROL_VERIFICAT';     // Rolul general de acces primit după CAPTCHA

// 🛑 SISTEM AUTOMAT ANTI-RAID
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

// Memorie cache dinamică pentru ID-urile de Discord extrase din fișierele .txt
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

client.once('ready', async () => {
    console.log(`🤖 Scutul Global este activ ca ${client.user.tag}!`);
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
        console.log('✅ Comenzile globale au fost înregistrate securizat!');
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

// Verificare securitate + Logica CAPTCHA aplicată tuturor oamenilor
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        if (LOCKDOWN_MODE && !isBulkScan) {
            await member.send(`🚨 Serverul este momentan securizat sub regim LOCKDOWN. Reîncearcă mai târziu.`).catch(() => null);
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

        // 3. OBLIGATORIU: TESTUL CAPTCHA PENTRU TOȚI OAMENII (Inclusiv conturi de Admin/Mod care reintră)
        if (targetChannel && !isBulkScan) {
            // Îi punem rolul de Neverificat (dacă este configurat în server)
            const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);

            // Construim butonul Anti-Phishing și Anti-Bot
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_captcha_button')
                    .setLabel('Verificare Securitate (Apasă aici) 🔓')
                    .setStyle(ButtonStyle.Danger) // Culoare roșie pentru atenție sporită
            );

            await targetChannel.send({
                content: `🛡️ **Sistem de Securitate Global**\nBun venit ${member}! Toate conturile (utilizatori, moderatori și administratori) trebuie să finalizeze verificarea anti-hijack.\n\n**Apasă pe butonul de mai jos pentru a primi acces.**`,
                components: [row]
            }).catch(() => null);
        }

        return { status: 'safe' };

    } catch (error) {
        return { status: 'error' };
    }
}

// 📥 EVENIMENT: Intrări membri noi pe server
client.on('guildMemberAdd', async (member) => {
    // Ignorăm complet boții autorizați (ei primesc acces direct, dar nu sunt oameni)
    if (member.user.bot) return;

    const now = Date.now();
    joinLog.push(now);
    joinLog = joinLog.filter(time => now - time < RAID_INTERVAL);

    if (joinLog.length > RAID_THRESHOLD && !LOCKDOWN_MODE) {
        LOCKDOWN_MODE = true;
        let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
        if (targetChannel) {
            await targetChannel.send(`🚨 **Sistemul a activat LOCKDOWN!** Detectat un posibil raid automatizat. Porțile serverului sunt temporar închise.`).catch(() => null);
        }
    }

    let targetChannel = member.guild.systemChannel || member.guild.channels.cache.find(c => c.type === ChannelType.GuildText);
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENIMENT: Interacțiuni (Comenzi + Butoane)
client.on('interactionCreate', async (interaction) => {
    // A. EXECUTARE COMENZI SLASH
    if (interaction.isChatInputCommand?.() || interaction.isCommand?.()) {
        if (!interaction.member.permissions.has('ADMINISTRATOR')) {
            return interaction.reply({ content: '❌ Doar un Administrator autorizat poate rula această comandă.', ephemeral: true });
        }

        if (interaction.commandName === 'scan') {
            await interaction.deferReply();
            loadLocalTextBlacklists();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0, bannedCount = 0;

            await interaction.editReply(`🔄 Se execută scanarea completă pe ${members.size} conturi active...`);

            for (const [id, member] of members) {
                if (member.user.bot) continue;
                const result = await performIndependentSecurityCheck(member, null, true); 
                if (result.status === 'safe') safeCount++;
                else if (result.status === 'banned') bannedCount++;
            }
            await interaction.editReply(`📊 **Scanare structurală completă!**\n✅ Conturi verificate ca sigure: ${safeCount}\n🔨 Eliminări din baza de date: ${bannedCount}`);
        }

        if (interaction.commandName === 'lockdown') {
            LOCKDOWN_MODE = !LOCKDOWN_MODE;
            return interaction.reply(`🚨 **Regimul LOCKDOWN** a fost setat pe: **${LOCKDOWN_MODE ? 'ACTIVAT (Intrările noi sunt blocate instant)' : 'DEZACTIVAT (Serverul a revenit la parametrii normali)'}**.`);
        }
        return;
    }

    // B. PROCESARE VERIFICARE BUTON (APLICABILĂ TUTUROR UTILIZATORILOR UMANI)
    if (interaction.isButton() && interaction.customId === 'verify_captcha_button') {
        const member = interaction.member;

        // Verificăm dacă are deja rolul de verificat pentru a preveni spam-ul pe buton
        if (member.roles.cache.has(ROL_VERIFIED_ID)) {
            return interaction.reply({ content: '❌ Acest cont deține deja acces complet pe server!', ephemeral: true });
        }

        try {
            const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

            // Eliminăm restricția (dacă există) și acordăm rolul de acces
            if (unverifiedRole) await member.roles.remove(unverifiedRole);
            if (verifiedRole) await member.roles.add(verifiedRole);

            await interaction.reply({ content: '✅ Verificare aprobată! Identitatea ta a fost confirmată cu succes. Ai primit acces.', ephemeral: true });
            
            // Ștergem mesajul cu buton din canal pentru a menține curățenia
            await interaction.message.delete().catch(() => null);

        } catch (err) {
            await interaction.reply({ content: '❌ Eroare la actualizarea rolurilor pe Discord. Verifică ierarhia botului.', ephemeral: true });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);