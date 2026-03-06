const readline = require('readline');

function createPrompt() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question) =>
    new Promise((resolve) => rl.question(question, (answer) => resolve(answer)));

  return {
    ask,
    close: () => rl.close(),
  };
}

module.exports = {
  createPrompt,
};
