const Discord = require("discord.js");
const DONO = "738812418532180062"; // Coloque seu ID
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const filePath = path.join(__dirname, '.', 'database', 'index.json');
function getHistory() {
    try {
        const rawData = fs.readFileSync(filePath);
        return JSON.parse(rawData);
    } catch (error) {
        console.error('Erro ao ler o arquivo index.json:', error);
        return {};
    }
}
function updateHistory(userId, domain) {
    const history = getHistory();

    if (!history[userId]) {
        history[userId] = {
            id: userId,
            domains: [domain],
        };
    } else {
        if (!history[userId].domains.includes(domain)) {
            history[userId].domains.push(domain);
        }
    }

    try {
        fs.writeFileSync(filePath, JSON.stringify(history, null, 4));
    } catch (error) {
        console.error('Erro ao escrever o arquivo index.json:', error);
    }
}
function isLinkValid(link) {
    const urlRegex = /^(ftp|http|https):\/\/[^ "]+$/;
    return urlRegex.test(link);
  }
module.exports = {
    name: "backlinks",
    description: "procura sites para você aumentar os BackLinks do seu dominio usando redirecionamentos.",
    options: [
        {
            type: Discord.ApplicationCommandOptionType.String,
            name: "domain",
            description: "Digite o dominio de backlinks, exemplo: exemplo.com, seu-blog.com",
            required: true
        },
        {
            type: Discord.ApplicationCommandOptionType.String,
            name: "query",
            description: "Quer ele com ou sem o www?",
            required: true,
            choices: [
                {
                    "name": "Com www, melhor para mim!",
                    "value": "none"
                },
                {
                    "name": "Sem www, desnecessário!",
                    "value": "with"
                }
            ]
        }
    ],

    run: async (client, interaction) => {
        if (interaction.user.id !== DONO) return interaction.reply({ content: `Apenas o meu dono pode utilizar este comando!`, ephemeral: true })

        try {
            const site = interaction.options.getString("domain");
            const query = interaction.options.getString("query");
            if (isLinkValid(site)) return interaction.reply({ content: `Dominio: [${site}](https://${query === 'none' ? site : query === 'with' ? `www.${site}` : 'Opção inválida'}/) inválido, digite apenas o seu dominio por exemplo: meu-blog.com, julia.com, não precisa do https:// apenas do dominio.`, ephemeral: true });
            await interaction.deferReply({ ephemeral: true });

            // Função para pesquisar no Bing
            async function searchBing(query) {
                const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
                const page = await browser.newPage();

                await page.goto(`https://www.bing.com/search?q=${encodeURIComponent(query)}`);
                await page.waitForTimeout(2000);

                await page.waitForSelector('div#b_content li.b_algo');

                async function getResults() {
                    const results = await page.evaluate(() => {
                        const searchResults = [];
                        const searchElements = document.querySelectorAll('div#b_content li.b_algo');

                        searchElements.forEach((el) => {
                            const title = el.querySelector('h2')?.innerText;
                            const link = el.querySelector('a')?.href;
                            const description = el.querySelector('div.b_caption p')?.innerText;

                            if (title && link) {
                                searchResults.push({ title, link, description });
                            }
                        });

                        return searchResults;
                    });

                    return results;
                }

                let allResults = [];
                const results = await getResults();
                allResults = allResults.concat(results);

                await browser.close();

                return allResults;
            }

            // Pesquisa no Bing e obtém os resultados
            const results = await searchBing('site:blogspot.com');

            // Cria uma lista de páginas dos resultados
            const pages = [];
            let currentPage = 0;
            const pageSize = 5; // Defina o número de resultados exibidos por página

            // Divide os resultados em páginas
            for (let i = 0; i < results.length; i += pageSize) {
                pages.push(results.slice(i, i + pageSize));
            }

            // Cria uma lista de domínios exibidos anteriormente ao usuário
    const history = getHistory();
    const userHistory = history[interaction.user.id]?.domains || [];

    // Remove os domínios já exibidos dos resultados
    const filteredResults = results.filter((result) => !userHistory.includes(result.link));

    // Se todos os resultados já foram exibidos anteriormente, envia uma mensagem informando ao usuário
    if (filteredResults.length === 0) {
        return interaction.editReply({
            content: 'Você já visualizou todos os resultados disponíveis. Tente novamente mais tarde.',
            ephemeral: true,
        });
    }

            // Cria e envia a embed com os resultados da primeira página
            const embed = new Discord.EmbedBuilder()
                .setTitle("Resultados da pesquisa")
                .setColor('#2f3136')
                .setDescription(pages[currentPage].map(result => `[${result.title}](${result.link + '?id=www.blogs-tutorials.com'})\n${result.description}`).join("\n\n") + `\`\`\`html\n<a href='https://${query === 'none' ? site : query === 'with' ? `www.${site}` : 'Opção inválida'}/'>👍🏻</a>\`\`\`Comente isso em todos os blogs/sites mostrados ou clique em comentar que nós faz para você!`)
                .setFooter({ text: `Resultado ${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, filteredResults.length)} de ${filteredResults.length}` });

            interaction.editReply({ embeds: [embed] });

            // Atualiza o histórico com os novos domínios exibidos ao usuário
    filteredResults.forEach((result) => updateHistory(interaction.user.id, result.link));

            // Adiciona botões para navegar pelos resultados
            const row = new Discord.ActionRowBuilder()
                .addComponents(
                    new Discord.ButtonBuilder()
                        .setCustomId('previous')
                        .setLabel('◀ Back page')
                        .setStyle(Discord.ButtonStyle.Secondary)
                        .setDisabled(true),
                    new Discord.ButtonBuilder()
                        .setCustomId('next')
                        .setLabel('Next page ▶')
                        .setStyle(Discord.ButtonStyle.Secondary)
                );

            // Função para atualizar a embed com os resultados da página atual
            const updateEmbed = () => {
                embed.setDescription(pages[currentPage].map(result => `[${result.title}](${result.link + '?id=www.blogs-tutorials.com'})\n${result.description}`).join("\n\n"));
                embed.setFooter({ text: `Resultado ${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, results.length)} de ${results.length}`});
                interaction.editReply({ embeds: [embed] });
            };

            // Cria um coletor para aguardar os cliques nos botões
            const collector = interaction.channel.createMessageComponentCollector({
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
                    }
                } else if (interaction.customId === 'next') {
                    if (currentPage < pages.length - 1) {
                        currentPage++;
                        row.components[0].setDisabled(false);
                        row.components[1].setDisabled(currentPage === pages.length - 1);
                        updateEmbed();
                    }
                }
            });

            collector.on('end', () => {
                // Remove os botões após o tempo limite (ou você pode deixá-los desabilitados)
                row.components.forEach(button => button.setDisabled(true));
            });

        } catch (error) {
            console.error('Ocorreu um erro:', error);
            return interaction.followUp({ content: `Ops ${interaction.user}, algo deu errado ao executar este comando.`, ephemeral: true });
        }
    }
};
