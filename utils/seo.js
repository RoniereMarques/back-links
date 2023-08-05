const Discord = require("discord.js");
const DONO = "738812418532180062"; // Coloque seu ID
const puppeteer = require('puppeteer');
const fs = require('fs').promises;

module.exports = {
    name: "seo",
    description: "procura sites para você aumentar o SEO do seu usando comentários.",
    options: [
        {
            type: Discord.ApplicationCommandOptionType.String,
            name: "query",
            description: "Qual termo que pesquisa para comentar?",
            required: false,
        }
    ],

    run: async (client, interaction) => {

        if (interaction.user.id !== DONO) return interaction.reply({ content: `Apenas o meu dono pode utilizar este comando!`, ephemeral: true })

        try {

            let query = interaction.options.getString("query");
            await interaction.deferReply({ ephemeral: true });

            // Função para pesquisar no Google
            async function searchGoogle(query) {
                
  const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();

  await page.goto('https://www.google.com');
  await page.waitForTimeout(2000);
  await page.type('textarea[name="q"]', query);
  await page.keyboard.press('Enter');

  await page.waitForFunction(() => document.querySelectorAll('div.g').length > 0, { timeout: 60000 });

  async function getResults() {
    const results = await page.evaluate(() => {
      const searchResults = [];
      const searchElements = document.querySelectorAll('div.g');

      searchElements.forEach((el) => {
        const title = el.querySelector('h3')?.innerText;
        const link = el.querySelector('a')?.href;
        const description = el.querySelector('div.s')?.innerText;

        if (title && link) {
          searchResults.push({ title, link, description });
        }
      });

      return searchResults;
    });

    return results;
  }

  let allResults = [];
  while (true) {
    const currentResults = await getResults();
    allResults = allResults.concat(currentResults);

    const nextButton = await page.$('#pnnext');
    if (nextButton) {
      await nextButton.click();
      await page.waitForTimeout(2000);
    } else {
      break;
    }
  }

  await browser.close();

  return allResults;
            }

            // Pesquisa no Google e obtém os resultados
            const results = await searchGoogle('site:blogspot.com');

            // Cria uma lista de páginas dos resultados
            const pages = [];
            let currentPage = 0;
            const pageSize = 5; // Defina o número de resultados exibidos por página

            // Divide os resultados em páginas
            for (let i = 0; i < results.length; i += pageSize) {
                pages.push(results.slice(i, i + pageSize));
            }

            // Cria e envia a embed com os resultados da primeira página
            const embed = new Discord.EmbedBuilder()
                .setTitle("Resultados da pesquisa")
                .setDescription(pages[currentPage].map(result => `[${result.title}](${result.link})\n${result.description}`).join("\n\n"))
                .setFooter({ text: `Página ${currentPage + 1} de ${pages.length}`, icon: interaction.user.displayAvatarURL()});

            const message = await interaction.editReply({ embeds: [embed] });

            // Adiciona botões para navegar pelos resultados
            const row = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('Anterior')
                        .setStyle(1)
                        .setDisabled(true),
                    new Discord.ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Próximo')
                        .setStyle(1)
                );

            message.edit({ components: [row] });

            // Função para atualizar a embed com os resultados da página atual
            const updateEmbed = () => {
                embed.setDescription(pages[currentPage].map(result => `[${result.title}](${result.link})\n${result.description}`).join("\n\n"));
                embed.setFooter({ text: `Página ${currentPage + 1} de ${pages.length}`, icon: interaction.user.displayAvatarURL()});
                message.edit({ embeds: [embed] });
            };

            // Cria um coletor para aguardar os cliques nos botões
            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 60000 // Tempo para o coletor expirar (60 segundos)
            });

            collector.on('collect', async (interaction) => {
                if (interaction.customId === 'previous') {
                    if (currentPage > 0) {
                        currentPage--;
                        row.components[0].setDisabled(currentPage === 0);
                        row.components[1].setDisabled(false);
                        updateEmbed();
                        interaction.update({ components: [row] });
                    }
                } else if (interaction.customId === 'next') {
                    if (currentPage < pages.length - 1) {
                        currentPage++;
                        row.components[0].setDisabled(false);
                        row.components[1].setDisabled(currentPage === pages.length - 1);
                        updateEmbed();
                        interaction.update({ components: [row] });
                    }
                }
            });

            collector.on('end', () => {
                // Remove os botões após o tempo limite (ou você pode deixá-los desabilitados)
                row.components.forEach(button => button.setDisabled(true));
                message.edit({ components: [row] });
            });

        } catch (error) {
            console.error('Ocorreu um erro:', error);
            return interaction.followUp({ content: `Ops ${interaction.user}, algo deu errado ao executar este comando.`, ephemeral: true });
        }
    }
};
