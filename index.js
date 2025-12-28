require("dotenv").config();
const keepAlive = require("./keepalive");
keepAlive();

const {
  Client,
  GatewayIntentBits,
  ChannelType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField
} = require("discord.js");

/* ================= CONFIG ================= */

const REPORTS_CHANNEL_ID = "1454725350578851850";
const MEMBER_ROLE_ID = "1454547996711846031";
const UNVERIFIED_ROLE_ID = "1454827522033189059";

const questions = [
  "Why do you want to join this server?",
  "How did you find this server?",
  "What will you contribute here?"
];

const applications = {};

/* ================= CLIENT ================= */

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ],
  partials: ["CHANNEL"]
});

client.once("ready", () => {
  console.log("BOT ONLINE HO GAYA ✅");
});

client.login(process.env.TOKEN);

/* ================= JOIN EVENT ================= */

client.on("guildMemberAdd", async (member) => {
  try {
    await member.roles.add(UNVERIFIED_ROLE_ID);
    await member.send(
      "Welcome! 👋\n\nReply **APPLY** to start verification."
    );
  } catch (err) {
    console.log("Join error:", err.message);
  }
});

/* ================= APPLICATION FLOW ================= */

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (message.channel.type !== ChannelType.DM) return;

  const userId = message.author.id;

  // START
  if (message.content.toLowerCase() === "apply") {
    applications[userId] = { step: 0, answers: [] };
    return message.channel.send(`**Q1.** ${questions[0]}`);
  }

  if (!applications[userId]) return;

  applications[userId].answers.push(message.content);
  applications[userId].step++;

  const step = applications[userId].step;

  if (step < questions.length) {
    return message.channel.send(`**Q${step + 1}.** ${questions[step]}`);
  }

  /* ===== SUBMIT ===== */

  const reportChannel = await client.channels.fetch(REPORTS_CHANNEL_ID);

  const embed = new EmbedBuilder()
    .setTitle("📥 New Application")
    .setColor(0x00ae86)
    .addFields(
      { name: "User", value: `<@${userId}>` },
      { name: "Q1", value: applications[userId].answers[0] },
      { name: "Q2", value: applications[userId].answers[1] },
      { name: "Q3", value: applications[userId].answers[2] }
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`accept_${userId}`)
      .setLabel("✅ Accept")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`deny_${userId}`)
      .setLabel("❌ Deny")
      .setStyle(ButtonStyle.Danger)
  );

  await reportChannel.send({ embeds: [embed], components: [row] });

  await message.channel.send(
    "✅ **Application submitted!** Please wait for admin approval."
  );

  delete applications[userId];
});

/* ================= BUTTON HANDLER ================= */

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  if (
    !interaction.member.permissions.has(
      PermissionsBitField.Flags.Administrator
    )
  ) {
    return interaction.reply({
      content: "❌ Admin only.",
      ephemeral: true
    });
  }

  const [action, userId] = interaction.customId.split("_");
  const member = await interaction.guild.members.fetch(userId).catch(() => null);

  if (!member) {
    return interaction.reply({ content: "User not found.", ephemeral: true });
  }

  if (action === "accept") {
    await member.roles.remove(UNVERIFIED_ROLE_ID);
    await member.roles.add(MEMBER_ROLE_ID);
    await member.send("✅ Your application has been approved!");

    return interaction.update({
      content: `✅ <@${userId}> accepted`,
      embeds: [],
      components: []
    });
  }

  if (action === "deny") {
    await member.send("❌ Your application was denied.");
    await member.kick("Application denied");

    return interaction.update({
      content: `❌ <@${userId}> denied & kicked`,
      embeds: [],
      components: []
    });
  }
});
