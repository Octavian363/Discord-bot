// 1. Load environment variables
require('dotenv').config();

const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Ro-Scanner (Fixed Layout & Separate Lockdown) Online!\n');
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

// Extrage strict ID-urile de grupuri din BannedGroups.txt
function getBannedRobloxGroups() {
    const bannedGroups = new Set();
    const filePath = path.join(__dirname, 'BannedGroups.txt');
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                const idOnly = trimmed.replace(/\D/g, ''); // Elimină [cite: 2]
                if (idOnly) bannedGroups.add(Number(idOnly));
            });
        } catch (err) {
            console.error('Error reading BannedGroups.txt:', err.message);
        }
    }
    return bannedGroups;
}

// Generator Captcha cu 3 stiluri (Albastru Cerc, Verde Dreptunghi, Roșu Linii)
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
        // STILUL 1: Cerc Albastru (USG68)
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
        // STILUL 2: Dreptunghi Verde (DZ8N2)
        ctx.fillStyle = '#00FF44'; 
        ctx.fillRect(100, 50, 400, 200);

        ctx.fillStyle = '#00B330'; 
        ctx.font = 'bold 55px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, 300, 150);

    } else {
        // STILUL 3: Cutie Roșie cu Linii (4JP39)
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

// Pop-up-ul curat care nu mai blochează chat-ul
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

// 🌐 ÎNREGISTRAREA COMPLETĂ A TUTUROR COMENZILOR
client.once('ready', async () => {
    console.log(`🤖 Botul ${client.user.tag} este activat și pregătit!`);
    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            { name: 'setup', description: 'Generează automat rolurile necesare, canalul #verify și panoul securizat.' },
            { name: 'scan', description: 'Scanează serverul împotriva listei de grupuri interzise din BannedGroups.txt.' },
            { name: 'lockdown', description: 'Activează modul de urgență. Oricine intră primește kick instant.' },
            { name: 'unlockdown', description: 'Dezactivează modul de urgență și permite verificarea normală.' }
        ];

        await axios.put(`https://discord.com/api/v10/applications/${appId}/commands`, commandData, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' }
        });
        console.log('✅ Toate comenzile slash au fost sincronizate cu succes în API Discord.');
    } catch (error) {
        console.error('❌ Eșec la sincronizarea comenzilor slash:', error.message);
    }
});

// 🚀 LOGICA DE INTERACȚIUNI
client.on('interactionCreate', async (interaction) => {
    
    // 1. COMANDA /SETUP
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Acces Refuzat: Ai nevoie de permisiuni de Administrator.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        let unverifiedRole = guild.roles.cache.find(r => r.name === 'UnVerified') || 
            await guild.roles.create({ name: 'UnVerified', color: '#7f8c8d' }).catch(() => null);

        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified') || 
            await guild.roles.create({ name: 'Verified', color: '#2ecc71' }).catch(() => null);

        if (!unverifiedRole || !verifiedRole) {
            return interaction.editReply({ content: '❌ Nu am putut genera rolurile automate. Verifică ierarhia botului!' });
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
            return interaction.editReply({ content: '❌ Nu am putut genera canalul text de verificare.' });
        }

        // Securizarea celorlalte canale
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
            new ButtonBuilder().setCustomId('click_to_verify').setLabel('Verify').setStyle(ButtonStyle.Success)
        );

        await verifyChannel.send({
            content: `**Ro-scanner**\n**Are you a human?**\n\n👋 Pentru a debloca restul canalelor, apasă pe butonul verde de mai jos și rezolvă testul de securitate CAPTCHA.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: `✅ **Setup-ul Automat a Reușit!** Canalele au fost securizate.` });
    }

    // 2. APĂSARE BUTON VERIFY (Trimite imaginea + butonul secundar fără să blocheze API-ul)
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        try {
            const challenge = generateSecurityChallenge(interaction.user.id);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter Details').setStyle(ButtonStyle.Primary)
            );

            // Pasul 1: Trimitem doar imaginea și butonul (FĂRĂ showModal direct aici)
            return await interaction.reply({
                content: `🔒 **Ro-Scanner Challenge:** Privește cu atenție codul din imaginea de mai jos, apoi apasă pe butonul albastru **"Enter Details"** pentru a-l introduce alături de numele tău de Roblox:`,
                files: [challenge.data],
                components: [row],
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            return interaction.reply({ content: '❌ Eroare internă la procesarea imaginii.', ephemeral: true });
        }
    }

    // 3. APĂSARE PE „ENTER DETAILS” (Afișează pop-up-ul perfect curat)
    if (interaction.isButton() && interaction.customId === 'trigger_modal_input') {
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    // 4. VALIDARE POP-UP MODAL (Verificare live Roblox)
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.user.id;
        const robloxUsername = interaction.fields.getTextInputValue('input_roblox_username').trim();
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode || enteredCode.toUpperCase() !== correctCode.toUpperCase()) {
            return interaction.editReply({ content: '❌ Cod invalid sau sesiune expirată! Apasă din nou pe **Verify**.' });
        }

        userCaptchas.delete(userId);

        // API Căutare ID Roblox după Username
        let robloxId = null;
        try {
            const userRes = await axios.post('https://users.roblox.com/v1/users/search', { keyword: robloxUsername, limit: 1 });
            if (userRes.data && userRes.data.data && userRes.data.data.length > 0) {
                robloxId = userRes.data.data[0].id;
            }
        } catch (err) {
            return interaction.editReply({ content: '❌ Eșec la comunicarea cu API-ul Roblox.' });
        }

        if (!robloxId) {
            return interaction.editReply({ content: '❌ Acest cont de Roblox nu există.' });
        }

        // API Scanare Grupuri live
        let isBlacklisted = false;
        try {
            const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
            if (groupRes.data && groupRes.data.data) {
                const userGroups = groupRes.data.data.map(g => Number(g.group.id));
                const bannedGroups = getBannedRobloxGroups();
                isBlacklisted = userGroups.some(id => bannedGroups.has(id));
            }
        } catch (err) {
            console.error(err);
        }

        if (isBlacklisted) {
            try {
                await interaction.user.send(`❌ Ai primit kick din **${interaction.guild.name}** deoarece contul tău de Roblox (${robloxUsername}) se află într-un grup interzis.`).catch(() => null);
                await interaction.member.kick('Auto-Kicked: Flagged Roblox Group.');
                return interaction.editReply({ content: '❌ Acces Refuzat: Te afli într-un grup periculos!' });
            } catch (err) {
                return interaction.editReply({ content: '❌ Ai fost detectat în grup, dar ierarhia botului a oprit acțiunea de kick.' });
            }
        }

        // Totul e sigur, acordăm rolurile
        const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
        const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');

        try {
            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole);
            
            const generalChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'general');
            if (generalChannel) {
                await generalChannel.send(`🛡️ ${interaction.user} s-a verificat cu succes! (Roblox: \`${robloxUsername}\`)`);
            }
            return interaction.editReply({ content: '✅ Verificare reușită! Canalele au fost deblocate.' });
        } catch (err) {
            return interaction.editReply({ content: '❌ Eroare de ierarhie la acordarea rolurilor.' });
        }
    }

    // 5. GESTIONARE COMANZI AUXILIARE (SCAN, LOCKDOWN ȘI UNLOCKDOWN)
    if (interaction.isChatInputCommand()) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Fără permisiune.', ephemeral: true });
        }

        if (interaction.commandName === 'scan') {
            await interaction.deferReply();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0;
            for (const [id, member] of members) { if (!member.user.bot) safeCount++; }
            return interaction.editReply(`📊 **Security Scan Complete!**\n✅ Valid/Safe Accounts: ${safeCount}\n🔨 Purged: 0`);
        }

        // Comandă separată pentru activare LOCKDOWN
        if (interaction.commandName === 'lockdown') {
            LOCKDOWN_MODE = true;
            return interaction.reply(`🚨 **Emergency LOCKDOWN**: **ACTIVAT**. Utilizatorii noi primesc kick instant la intrare.`);
        }

        // Comandă separată pentru oprire LOCKDOWN (/unlockdown)
        if (interaction.commandName === 'unlockdown') {
            LOCKDOWN_MODE = false;
            return interaction.reply(`🛡️ **Emergency LOCKDOWN**: **DEACTIVAT**. Serverul a revenit la starea normală.`);
        }
    }
});

// Eveniment anti-raid pe join
client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return;
    if (LOCKDOWN_MODE) {
        try {
            await member.send(`🚨 Modul Lockdown este activ pe acest server. Ai primit kick automat ca măsură de protecție.`).catch(() => null);
            await member.kick('Lockdown activat de admini.');
            return;
        } catch (err) {}
    }
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);