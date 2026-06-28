// 1. Încărcăm variabilele de mediu (.env) primele pentru siguranță
require('dotenv').config();

// 2. Serverul web HTTP cerut de Render pentru a preveni eroarea de "Timeout"
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Botul de securitate avansat (Scanner + CAPTCHA) este online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Serverul de mentinere activa ruleaza pe portul ${port}.`);
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

// 🛡️ CONFIGURARE ROLURI PENTRU CAPTCHA (Pune ID-urile rolurilor tale din server aici)
const ROL_UNVERIFIED_ID = 'ID_ROL_NEVERIFICAT'; // Rol primit la intrare
const ROL_VERIFIED_ID = 'ID_ROL_VERIFICAT';     // Rol primit după ce apasă pe buton

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
                console.log(`📁 S-au extras ${lines.length} ID-uri din fișierul local: ${fileName}`);
            } catch (err) {
                console.error(`❌ Eroare la citirea fișierului ${fileName}:`, err.message);
            }
        });

        BLACKLISTED_DISCORD_USERS = [...new Set(tempIds)];
        console.log(`✅ [SINC] Încărcare completă! Total ID-uri Discord unice în baza locală: ${BLACKLISTED_DISCORD_USERS.length}`);

    } catch (error) {
        console.error('❌ Eroare gravă la scanarea directoarelor pentru fișiere text:', error.message);
    }
}

// Înregistrare comenzi Discord la pornirea aplicației
client.once('ready', async () => {
    console.log(`🤖 Global Security Bot is online as ${client.user.tag}!`);
    loadLocalTextBlacklists();

    try {
        console.log('🔄 Registering global slash commands via HTTP API...');
        const appId = client.application?.id || client.user?.id;
        if (!appId) throw new Error("ID-ul aplicatiei nu a putut fi identificat în cache la pornire.");

        const commandData = [
            {
                name: 'scan',
                description: 'Scaneaza serverul folosinf listele Roblox si ID-urile din fisierele text.'
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Global Slash commands (/scan) registered successfully!');
    } catch (error) {
        console.error('❌ Failed to register commands:', error.message);
    }
});

function getRobloxUsername(member) {
    const customStatus = member.presence?.activities?.find(a => a.type === 4); 
    if (customStatus && customStatus.state) {
        return customStatus.state.trim();
    }
    return member.user.username;
}

// Funcția centralizată de verificare a securității + Trimitere CAPTCHA
async function performIndependentSecurityCheck(member, targetChannel = null, isBulkScan = false) {
    try {
        // 1. SECURITATE DISCORD (.TXT)
        if (BLACKLISTED_DISCORD_USERS.includes(member.id)) {
            await member.send(`⚠️ ${member.user.username} you have been banned from this server. Reason: Flagged in Blacklist Database.`).catch(() => null);
            await member.ban({ reason: 'Independent Security: Utilizator listat în fișierele text (.txt).' }).catch(() => null);
            return { status: 'banned', source: 'Discord' };
        }

        // 2. SECURITATE ROBLOX
        const robloxUsername = getRobloxUsername(member);
        const userResponse = await axios.post('https://users.roblox.com/v1/usernames/users', {
            usernames: [robloxUsername],
            excludeBannedUsers: false
        });

        if (userResponse.data && userResponse.data.data.length > 0) {
            const robloxId = userResponse.data.data[0].id;
            const groupsResponse = await axios.get(`https://groups.roblox.com/v2/users/${robloxId}/groups/roles`);
            
            if (groupsResponse.data && groupsResponse.data.data) {
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
                    await member.send(`⚠️ ${member.user.username} you have been banned from the group ${flaggedGroupName}`).catch(() => null);
                    await member.ban({ reason: `Independent Security: Membru Roblox în grupul Condo listat (${flaggedGroupName})` }).catch(() => null);
                    return { status: 'banned', source: 'Roblox', reason: flaggedGroupName };
                }
            }
        }

        // 3. DACĂ CONTUL ESTE SIGUR -> APLICĂ SISTEMUL CAPTCHA (doar dacă intră de la sine, nu la /scan general)
        if (targetChannel && !isBulkScan) {
            // Îi punem rolul de Neverificat
            const unverifiedRole = member.guild.roles.cache.get(ROL_UNVERIFIED_ID);
            if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);

            // Construim butonul de verificare anti-bot
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_captcha_button')
                    .setLabel('Sunt om, deblochează serverul 🔓')
                    .setStyle(ButtonStyle.Success)
            );

            // Trimitem mesajul cu buton pe canalul de înregistrare
            await targetChannel.send({
                content: `👋 Salutare ${member}! Contul tău a trecut testele automate de securitate.\n**Apasă pe butonul de mai jos pentru a trece testul CAPTCHA și a primi acces pe server.**`,
                components: [row]
            }).catch(() => null);
        }

        return { status: 'safe' };

    } catch (error) {
        return { status: 'error' };
    }
}

// 📥 EVENIMENT: Când cineva intră nou pe server
client.on('guildMemberAdd', async (member) => {
    // Încearcă să folosească canalul de sistem, altfel caută primul canal text
    let targetChannel = member.guild.systemChannel;
    if (!targetChannel) {
        targetChannel = member.guild.channels.cache.find(
            channel => channel.type === ChannelType.GuildText || channel.type === 'GUILD_TEXT'
        );
    }
    await performIndependentSecurityCheck(member, targetChannel, false);
});

// 🚀 EVENIMENT: Interacțiuni (Butoane + Comenzi)
client.on('interactionCreate', async (interaction) => {
    // A. COMANDE SLASH (/scan)
    if (interaction.isChatInputCommand?.() || interaction.isCommand?.()) {
        if (interaction.commandName === 'scan') {
            await interaction.deferReply(); 

            if (!interaction.member.permissions.has('ADMINISTRATOR') && !interaction.member.permissions.has('Administrator')) {
                return interaction.editReply('❌ Nu ai permisiunea de Administrator pentru a utiliza această comandă.');
            }

            loadLocalTextBlacklists();
            const channel = interaction.channel;
            const members = await interaction.guild.members.fetch();
            let safeCount = 0;
            let bannedCount = 0;

            await interaction.editReply(`🔄 Se începe scanarea completă pentru cei ${members.size} membri...`);

            for (const [id, member] of members) {
                if (member.user.bot) continue;
                const result = await performIndependentSecurityCheck(member, null, true); 
                if (result.status === 'safe') safeCount++;
                else if (result.status === 'banned') bannedCount++;
            }

            await interaction.editReply(`📊 **Scanare finalizată!**\n✅ Utilizatori siguri: ${safeCount}\n🔨 Utilizatori periculoși eliminați: ${bannedCount}`).catch(() => null);
        }
        return;
    }

    // B. CORECTARE BUTON CAPTCHA
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_captcha_button') {
            const member = interaction.member;

            // Verificăm dacă cel ce a apăsat butonul are rolul de neverificat (ca să nu poată da oricine click)
            if (!member.roles.cache.has(ROL_UNVERIFIED_ID)) {
                return interaction.reply({
                    content: '❌ Contul tău este deja verificat sau nu necesită această acțiune!',
                    ephemeral: true
                });
            }

            try {
                const unverifiedRole = interaction.guild.roles.cache.get(ROL_UNVERIFIED_ID);
                const verifiedRole = interaction.guild.roles.cache.get(ROL_VERIFIED_ID);

                // Scoatem rolul restrictiv și punem rolul complet de membru
                if (unverifiedRole) await member.roles.remove(unverifiedRole);
                if (verifiedRole) await member.roles.add(verifiedRole);

                // Îi răspundem doar lui în mod privat (ephemeral) ca să știe că a reușit
                await interaction.reply({
                    content: '✅ Verificare reușită! Rolul de membru ți-a fost acordat. Distracție plăcută pe server!',
                    ephemeral: true
                });

                // Ștergem automat mesajul general cu butonul ca să menținem canalul curat
                await interaction.message.delete().catch(() => null);

            } catch (err) {
                await interaction.reply({
                    content: '❌ A apărut o eroare la salvarea rolurilor. Contactează un administrator.',
                    ephemeral: true
                });
            }
        }
    }
});

client.login(process.env.DISCORD_TOKEN);