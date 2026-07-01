// 1. Load environment variables
require('dotenv').config();

const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
   res.writeHead(200, { 'Content-Type': 'text/plain' });
   res.end('Ro-Scanner (Multi-Style Captcha & Group Check) Online!\n');
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

// Curăță și extrage strict ID-urile numerice din BannedGroups.txt
function getBannedRobloxGroups() {
    const bannedGroups = new Set();
    const filePath = path.join(__dirname, 'BannedGroups.txt');
    if (fs.existsSync(filePath)) {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            content.split(/\r?\n/).forEach(line => {
                const trimmed = line.trim();
                const idOnly = trimmed.replace(/\D/g, ''); // Elimină sau alte caractere non-cifre
                if (idOnly) bannedGroups.add(Number(idOnly));
            });
        } catch (err) {
            console.error('Error reading BannedGroups.txt:', err.message);
        }
    }
    return bannedGroups;
}

// Generează dinamic stilurile trimise în imagini (Albastru Cerc, Verde Dreptunghi, Roșu Linii)
function generateSecurityChallenge(userId) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; 
    let code = '';
    for (let i = 0; i < 5; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    userCaptchas.set(userId, code);

    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');
    
    // Fundal alb general generat curat
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const styleRoll = Math.random();

    if (styleRoll < 0.34) {
        // STILUL 1: Cercul Albastru (Inspirat de imaginea ta USG68)
        ctx.fillStyle = '#0044FF'; 
        ctx.beginPath();
        ctx.arc(300, 150, 120, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#002BB3'; // Text de vizibilitate redusă (nuanță apropiată)
        ctx.font = 'bold 55px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        ctx.save();
        ctx.translate(300, 150);
        ctx.rotate(-0.05); // O ușoară înclinație stilistică
        ctx.fillText(code, 0, 0);
        ctx.restore();

    } else if (styleRoll < 0.67) {
        // STILUL 2: Dreptunghiul Verde (Inspirat de imaginea ta DZ8N2)
        ctx.fillStyle = '#00FF44'; 
        ctx.fillRect(100, 50, 400, 200);

        ctx.fillStyle = '#00B330'; 
        ctx.font = 'bold 55px sans-serif'; 
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(code, 300, 150);

    } else {
        // STILUL 3: Cutia Roșie cu Linii de distorsionare (Inspirat de imaginea ta 4JP39)
        ctx.fillStyle = '#FF2222'; 
        ctx.fillRect(30, 30, 540, 240);

        // Adăugăm liniile de camuflaj specifice
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
            const x = startX + (i * spacing);
            const y = 150 + (Math.random() * 30 - 15);
            ctx.translate(x, y);
            ctx.rotate((Math.random() * 0.4) - 0.2);
            ctx.fillText(code[i], 0, 0);
            ctx.restore();
        }
    }

    const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'captcha.png' });
    return { data: attachment };
}

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

client.once('ready', async () => {
    console.log(`🤖 Ro-Scanner system online and ready.`);
    try {
        const appId = client.application?.id || client.user?.id;
        const commandData = [{ name: 'setup', description: 'Deploys Ro-scanner text channel interface.' }];
        await axios.put(`https://discord.com/api/v10/applications/${appId}/commands`, commandData, {
            headers: { Authorization: `Bot ${process.env.DISCORD_TOKEN}`, 'Content-Type': 'application/json' }
        });
    } catch (err) {}
});

client.on('interactionCreate', async (interaction) => {
    
    if (interaction.isChatInputCommand() && interaction.commandName === 'setup') {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) return interaction.reply({ content: '❌ Admin required.', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        
        let verifyChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'verify');
        if (!verifyChannel) {
            verifyChannel = await interaction.guild.channels.create({ name: 'verify', type: ChannelType.GuildText });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('click_to_verify').setLabel('Verify Account').setStyle(ButtonStyle.Primary)
        );

        await verifyChannel.send({
            content: `**Ro-scanner**\n**Are you a human?**\n\nClick the verification button below, fill in your Roblox account name and complete the image check security layer to get verified.`,
            components: [row]
        }).catch(() => null);

        return interaction.editReply({ content: '✅ Verification gate deployed successfully!' });
    }

    if (interaction.isButton() && interaction.customId === 'click_to_verify') {
        await interaction.deferReply({ ephemeral: true });
        const challenge = generateSecurityChallenge(interaction.user.id);
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('trigger_modal_input').setLabel('Enter Details').setStyle(ButtonStyle.Success)
        );
        return interaction.editReply({ content: '🔒 **Ro-Scanner Challenge Loaded:** Solve the security box below:', files: [challenge.data], components: [row] });
    }

    if (interaction.isButton() && interaction.customId === 'trigger_modal_input') {
        return interaction.showModal(createVerificationModal()).catch(() => null);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'modal_captcha_submit') {
        await interaction.deferReply({ ephemeral: true });
        
        const userId = interaction.user.id;
        const robloxUsername = interaction.fields.getTextInputValue('input_roblox_username').trim();
        const enteredCode = interaction.fields.getTextInputValue('input_captcha_field').trim();
        const correctCode = userCaptchas.get(userId);

        if (!correctCode || enteredCode.toUpperCase() !== correctCode.toUpperCase()) {
            return interaction.editReply({ content: '❌ Incorrect captcha security token. Click Verify Account to try again.' });
        }

        userCaptchas.delete(userId);

        // Pasul 1: Obținere ID utilizator după username din API-ul Roblox
        let robloxId = null;
        try {
            const userRes = await axios.post('https://users.roblox.com/v1/users/search', {
                keyword: robloxUsername,
                limit: 1
            });
            if (userRes.data && userRes.data.data && userRes.data.data.length > 0) {
                robloxId = userRes.data.data[0].id;
            }
        } catch (err) {
            return interaction.editReply({ content: '❌ Communication failure with Roblox API. Check spelling.' });
        }

        if (!robloxId) {
            return interaction.editReply({ content: '❌ Username target not found on Roblox platforms.' });
        }

        // Pasul 2: Scanarea în timp real a listei din BannedGroups.txt
        let isBlacklisted = false;
        try {
            const groupRes = await axios.get(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
            if (groupRes.data && groupRes.data.data) {
                const userGroups = groupRes.data.data.map(g => Number(g.group.id));
                const bannedGroups = getBannedRobloxGroups();

                // Verifică potrivirea exactă de ID de grup live
                isBlacklisted = userGroups.some(id => bannedGroups.has(id));
            }
        } catch (err) {
            console.error('Group Fetch Error:', err.message);
        }

        if (isBlacklisted) {
            try {
                await interaction.user.send(`❌ Kicked from **${interaction.guild.name}**: Your Roblox profile belongs to a blacklisted community line (${robloxUsername}).`).catch(() => null);
                await interaction.member.kick('Auto-Kicked: Identified inside an illegal Roblox Group registry.');
                return interaction.editReply({ content: '❌ Access Denied: Bound Roblox profile found in blacklisted databases!' });
            } catch (err) {
                return interaction.editReply({ content: '❌ Threat isolated, but role hierarchy restricted bot expulsion action.' });
            }
        }

        // Succes: Utilizatorul trece protecția
        const verifiedRole = interaction.guild.roles.cache.find(r => r.name === 'Verified');
        const unverifiedRole = interaction.guild.roles.cache.find(r => r.name === 'UnVerified');

        try {
            if (unverifiedRole) await interaction.member.roles.remove(unverifiedRole);
            if (verifiedRole) await interaction.member.roles.add(verifiedRole);
            
            const generalChannel = interaction.guild.channels.cache.find(c => c.name.toLowerCase() === 'general');
            if (generalChannel) {
                await generalChannel.send(`🛡️ ${interaction.user} verified successfully (Roblox: \`${robloxUsername}\`). Safe account check passed.`);
            }
            return interaction.editReply({ content: '✅ Verification complete. Welcome!' });
        } catch (err) {
            return interaction.editReply({ content: '❌ Setup configuration error: Ensure bot role is set to highest hierarchy position.' });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);