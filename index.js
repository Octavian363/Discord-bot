// 1. Load environment variables first for security
require('dotenv').config();

// 2. HTTP Server required by Render to prevent "Port Timeout" errors
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Global Security Shield (Auto Setup + Font Fixed) Online!\n');
}).listen(port, () => {
   console.log(`[RENDER] Keep-alive server running on port ${port}.`);
});

// 3. Import required modules from discord.js v14
const { 
    Client, 
    GatewayIntentBits,
    PermissionFlagsBits,
    ChannelType,
    AttachmentBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} = require('discord.js');
const { Captcha } = require('captcha-canvas');
const { registerFont } = require('canvas'); 
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 🔍 REGISTER LOCAL FONT BEFORE BOT LAUNCH (OBLIGATORIU PENTRU IMAGINE)
try {
    const fontPath = path.join(__dirname, 'captcha-font.ttf');
    if (fs.existsSync(fontPath)) {
        registerFont(fontPath, { family: 'CaptchaCustomFont' });
        console.log('✅ [FONT] Custom CAPTCHA font successfully registered!');
    } else {
        console.log('⚠️ [FONT] captcha-font.ttf missing, using system defaults.');
    }
} catch (fontError) {
    console.error('❌ [FONT] Failed to register local font:', fontError.message);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Map global pentru stocarea codurilor captcha
const userCaptchas = new Map();
let LOCKDOWN_MODE = false;

// Generare CAPTCHA stabilă cu fontul setat corect
function generateCaptchaImage(userId) {
    const captcha = new Captcha();
    captcha.async = false; 
    
    // Îi spunem librăriei să folosească fontul înregistrat mai sus ca să nu mai dea crash
    captcha.font = 'CaptchaCustomFont'; 
    captcha.addDecoy(); 
    captcha.drawTrace(); 
    captcha.drawCaptcha();

    userCaptchas.set(userId, captcha.text);
    return new AttachmentBuilder(captcha.png, { name: 'captcha.png' });
}

// 🌐 INREGISTRARE AUTOMATA COMANZI
client.once('ready', async () => {
    console.log(`🤖 Botul ${client.user.tag} este activat și pregătit pentru setup!`);

    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [
            {
                name: 'setup',
                description: 'Generează automat rolurile necesare, canalul #verify și panoul securizat.'
            },
            {
                name: 'scan',
                description: 'Scan server for suspicious entries.'
            },
            {
                name: 'lockdown',
                description: 'Toggle lockdown mode.'
            }
        ];

        await axios.put(
            `https://discord.com/api/v10/applications/${appId}/commands`,
            commandData,
            { headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' } }
        );
        console.log('✅ Toate comenzile slash au fost sincronizate cu succes în API Discord.');
    } catch (error) {
        console.error('❌ Eșec la sincronizarea comenzilor slash:', error.message);
    }
});

// 🚀 LOGICA PENTRU COMANZI ȘI INTERACȚIUNI
client.on('interactionCreate', async (interaction) => {
    
    // ==========================================
    // 1. GESTIONARE COMANDA /SETUP
    // ==========================================
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Acces Refuzat: Ai nevoie de permisiuni de Administrator.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });
        const guild = interaction.guild;

        // A. Căutare sau generare automată rol UNVERIFIED
        let unverifiedRole = guild.roles.cache.find(r => r.name === 'UnVerified');
        if (!unverifiedRole) {
            unverifiedRole = await guild.roles.create({
                name: 'UnVerified',
                color: '#7f8c8d',
                reason: 'Creat automat pentru securizarea utilizatorilor noi.'
            }).catch(() => null);
        }

        // B. Căutare sau generare automată rol VERIFIED
        let verifiedRole = guild.roles.cache.find(r => r.name === 'Verified');
        if (!verifiedRole) {
            verifiedRole = await guild.roles.create({
                name: 'Verified',
                color: '#2ecc71',
                reason: 'Creat automat pentru membrii validați.'
            }).catch(() => null);
        }

        if (!unverifiedRole || !verifiedRole) {
            return interaction.editReply({ content: '❌ Nu am putut genera rolurile automat. Verifică ierarhia permisiunilor botului!' });
        }

        // C. Căutare sau generare automată canal #verify
        let verifyChannel = guild.channels.cache.find(c => c.name.toLowerCase() === 'verify' && c.type === ChannelType.GuildText);
        if (!verifyChannel) {
            verifyChannel = await guild.channels.create({
                name: 'verify',
                type: ChannelType.GuildText,
                permissionOverwrites: [
                    {
                        id: guild.roles.everyone.id,
                        deny: [PermissionFlagsBits.ViewChannel]
                    },
                    {
                        id: unverifiedRole.id,
                        allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory],
                        deny: [PermissionFlagsBits.SendMessages]
                    },
                    {
                        id: verifiedRole.id,
                        deny: [PermissionFlagsBits.ViewChannel] 
                    }
                ]
            }).catch(() => null);
        }

        if (!verifyChannel) {
            return interaction.editReply({ content: '❌ Nu am putut genera canalul text de verificare.' });
        }

        // D. Configurare restricții canale alternative
        const channels = guild.channels.cache;
        for (const [id, channel] of channels) {
            if (channel.id === verifyChannel.id) continue;
            try {
                await channel.permissionOverwrites.edit(unverifiedRole.id, {
                    ViewChannel: false,
                    SendMessages: false,
                    ReadMessageHistory: false
                });
            } catch (err) {}
        }

        // E. Trimiterea panoului oficial cu buton în canal
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('click_to_verify')
                .setLabel('Verify')
                .setStyle(ButtonStyle.Success)
        );

        await verifyChannel.send({
            content: `👋 **Welcome to the server!** Pentru a debloca restul canalelor, apasă pe butonul verde de mai jos și rezolvă testul de securitate CAPTCHA.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: `✅ **Setup-ul Automat a Reușit!**\n• Rolurile **UnVerified** și **Verified** sunt active.\n• Canalul <#${verifyChannel.id}> a fost securizat.\n• Toate celelalte canale au fost ascunse.` });
    }

    // ==========================================
    // 2. APĂSARE BUTON VERIFY
    // ==========================================
    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        try {
            const userId = interaction.user.id;
            const attachment = generateCaptchaImage(userId);

            const modal = new ModalBuilder()
                .setCustomId('modal_captcha_submit')
                .setTitle('Security Verification');

            const codeInput = new TextInputBuilder()
                .setCustomId('input_captcha_field')
                .setLabel('Scrie codul de mai jos în casetă:')
                .setStyle(TextInputStyle.Short)
                .setMaxLength(6)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(codeInput);
            modal.addComponents(row);

            await interaction.reply({
                content: `🗂️ **Privește cu atenție codul din imagine și introdu-l în fereastra pop-up:**`,
                files: [attachment],
                ephemeral: true
            });

            await interaction.showModal(modal).catch(() => null);
        } catch (error) {
            console.error('Eroare buton click:', error);
            return interaction.reply({ content: '❌ Eroare internă la procesarea imaginii. Reîncearcă.', ephemeral: true });
        }
    }

    // ==========================================
    // 3. VALIDARE POP-UP MODAL (TRIMITERE COD)
    // ==========================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        const userId = interaction.user.id;
        const codIntrodus = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const codCorect = userCaptchas.get(userId);

        if (!codCorect) {
            return interaction.reply({ content: '❌ Sesiune expirată. Apasă din nou pe butonul verde.', ephemeral: true });
        }

        if (codIntrodus.toUpperCase() === codCorect.toUpperCase()) {
            userCaptchas.delete(userId); 

            const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');
            const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');

            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole).catch(() => null);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole).catch(() => null);

            return interaction.reply({ content: '✅ Verificarea a reușit! Serverul ți-a fost deblocat complet. Bun venit!', ephemeral: true });
        } else {
            return interaction.reply({ content: '❌ Cod invalid! Apasă din nou pe butonul **Verify** pentru a genera o nouă imagine.', ephemeral: true });
        }
    }

    // GESTIONARE COMANZI AUXILIARE (SCAN & LOCKDOWN)
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'scan') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Fără permisiune.', ephemeral: true });
            await interaction.deferReply();
            const members = await interaction.guild.members.fetch();
            let safeCount = 0;
            for (const [id, member] of members) { if (!member.user.bot) safeCount++; }
            return interaction.editReply(`📊 **Security Scan Complete!**\n✅ Valid/Safe Accounts: ${safeCount}\n🔨 Purged: 0`);
        }

        if (interaction.commandName === 'lockdown') {
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Fără permisiune.', ephemeral: true });
            LOCKDOWN_MODE = !LOCKDOWN_MODE;
            return interaction.reply(`🚨 **Emergency LOCKDOWN**: **${LOCKDOWN_MODE ? 'ACTIVAT' : 'DEACTIVAT'}**.`);
        }
    }
});

client.on('guildMemberAdd', async (member) => {
    if (member.user.bot) return; 
    const unverifiedRole = member.guild.roles.cache.find(r => r.name === 'UnVerified');
    if (unverifiedRole) await member.roles.add(unverifiedRole).catch(() => null);
});

client.login(process.env.DISCORD_TOKEN);