const express = require("express");
const path = require("path");
const app = express();
const dotenv = require("dotenv");

dotenv.config();

// Configurar headers de cache apropriados
app.use(express.static(path.join(__dirname, "build"), {
    setHeaders: (res, filePath) => {
        // HTML files - nunca cachear
        if (filePath.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        // JS e CSS com hash - cachear por 1 ano
        else if (filePath.match(/\.(js|css)$/) && filePath.includes('chunk')) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        // Imagens e fontes - cachear por 1 mês
        else if (filePath.match(/\.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000');
        }
        // JSON e outros arquivos - cache curto
        else {
            res.setHeader('Cache-Control', 'public, max-age=3600');
        }
    }
}));

app.get("/*", function (req, res) {
    // Garantir que index.html nunca seja cacheado
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, "build", "index.html"));
});

const port = process.env.SERVER_PORT || 3000;

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
