document.addEventListener("DOMContentLoaded", () => {
    const designSystemInput = document.getElementById("design-system-input");
    const designSystemStatus = document.getElementById("design-system-status");
    const urlInputField = document.getElementById("url-input-field");
    const addUrlButton = document.getElementById("add-url-button");
    const urlList = document.getElementById("url-list");
    const analyzeButton = document.getElementById("analyze-button");
    const resultsContainer = document.getElementById("results-container");
  
    let designSystem = null;
    let urls = [];
  
    // Gérer l'importation du Design System
    designSystemInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            designSystem = JSON.parse(e.target.result);
            designSystemStatus.textContent = `Fichier chargé : ${file.name}`;
            checkAnalyzeButtonState();
          } catch (err) {
            alert("Le fichier n'est pas un JSON valide.");
            designSystemStatus.textContent = "Aucun fichier chargé";
          }
        };
        reader.readAsText(file);
      }
    });
  
    // Ajouter une URL
    addUrlButton.addEventListener("click", () => {
      const url = urlInputField.value.trim();
      if (url && !urls.includes(url)) {
        urls.push(url);
        renderUrlList();
        urlInputField.value = "";
        checkAnalyzeButtonState();
      }
    });
  
    // Supprimer une URL
    function removeUrl(index) {
      urls.splice(index, 1);
      renderUrlList();
      checkAnalyzeButtonState();
    }
  
    // Afficher la liste des URLs
    function renderUrlList() {
      urlList.innerHTML = "";
      urls.forEach((url, index) => {
        const li = document.createElement("li");
        li.textContent = url;
  
        const removeButton = document.createElement("button");
        removeButton.textContent = "Supprimer";
        removeButton.classList.add("remove-button");
        removeButton.addEventListener("click", () => removeUrl(index));
  
        li.appendChild(removeButton);
        urlList.appendChild(li);
      });
    }
  
    // Activer/désactiver le bouton Analyser
    function checkAnalyzeButtonState() {
      analyzeButton.disabled = !designSystem || urls.length === 0;
    }
  
    // Nettoyer le JSON renvoyé par GPT
    function cleanJSON(responseText) {
      // Enlever tout le formatage Markdown et JSON
      let cleaned = responseText
        .replace(/```json/gi, '')    // Supprime les balises ```json
        .replace(/```/g, '')         // Supprime les balises ```
        .replace(/###.*\n/g, '')     // Supprime les titres Markdown
        .replace(/\n/g, ' ')         // Remplace les sauts de ligne par des espaces
        .trim();
  
      // Chercher le premier { et le dernier }
      const startIndex = cleaned.indexOf('{');
      const endIndex = cleaned.lastIndexOf('}') + 1;
  
      if (startIndex === -1 || endIndex === 0) {
        throw new Error("Aucun objet JSON valide trouvé dans la réponse");
      }
  
      // Extraire uniquement la partie JSON
      return cleaned.slice(startIndex, endIndex);
    }
  
    // Appeler GPT-3.5-turbo pour analyser les URLs
    async function callGPT(prompt) {
      const apiKey = "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";
      const apiUrl = "https://api.openai.com/v1/chat/completions";
  
      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { 
                role: "system", 
                content: "Tu es un expert en analyse de sites web. Réponds UNIQUEMENT en JSON valide avec la structure suivante: {\"url\": string, \"designCompliance\": number, \"techCompliance\": number, \"accessibility\": number, \"issues\": string[]}" 
              },
              { role: "user", content: prompt },
            ],
            max_tokens: 2000,
            temperature: 0.3,
          }),
        });
  
        if (!response.ok) {
          throw new Error(`Erreur API: ${response.status}`);
        }
  
        const data = await response.json();
        const rawResponseText = data.choices?.[0]?.message?.content;
  
        if (!rawResponseText) {
          throw new Error("Réponse vide de l'API");
        }
  
        const cleanResponseText = cleanJSON(rawResponseText);
        return JSON.parse(cleanResponseText);
  
      } catch (error) {
        console.error("Erreur lors de l'appel API:", error);
        throw new Error(`Erreur d'analyse: ${error.message}`);
      }
    }
  
    // Gérer le clic sur le bouton Analyser
    analyzeButton.addEventListener("click", async () => {
      resultsContainer.innerHTML = "<p class='loading'>Analyse en cours...</p>";
  
      try {
        const prompt = generatePrompt(designSystem, urls);
        const results = await callGPT(prompt);
  
        if (results) {
          displayResults(results);
        } else {
          resultsContainer.innerHTML = "<p class='error-message'>Aucun résultat reçu.</p>";
        }
      } catch (error) {
        resultsContainer.innerHTML = `
          <div class="error-message">
            <p>Erreur lors de l'analyse.</p>
            <details>
              <summary>Plus d'informations</summary>
              <pre>${error.message}</pre>
            </details>
          </div>`;
      }
    });
  
    // Générer le prompt pour GPT
    function generatePrompt(designSystem, urls) {
      return `
        Analyse technique détaillée des URLs suivantes selon ce Design System:
        ${JSON.stringify(designSystem, null, 2)}
  
        URLs à analyser: ${urls.join(", ")}
  
        Analyse chaque balise HTML (<div>, <p>, <h1>, <button>, etc.) et compare leurs propriétés CSS avec les spécifications du Design System.
        Pour chaque élément non conforme, fournis une analyse détaillée avec cette structure:
        {
          "url": "URL analysée",
          "designCompliance": pourcentage (0-100),
          "techCompliance": pourcentage (0-100),
          "accessibility": pourcentage (0-100),
          "nonCompliantElements": {
            "headings": [
              {
                "tag": "<h1>, <h2>, etc.",
                "location": "chemin de la balise (ex: header > h1)",
                "issues": [
                  {
                    "property": "font-size, color, margin, etc.",
                    "currentValue": "valeur actuelle",
                    "expectedValue": "valeur du Design System",
                    "impact": "impact sur l'accessibilité ou le design"
                  }
                ]
              }
            ],
            "paragraphs": [
              {
                "tag": "<p>",
                "location": "chemin de la balise",
                "issues": []
              }
            ],
            "buttons": [
              {
                "tag": "<button>",
                "location": "chemin de la balise",
                "issues": []
              }
            ],
            "containers": [
              {
                "tag": "<div>, <section>, <article>",
                "location": "chemin de la balise",
                "issues": []
              }
            ],
            "navigation": [
              {
                "tag": "<nav>, <a>",
                "location": "chemin de la balise",
                "issues": []
              }
            ],
            "forms": [
              {
                "tag": "<input>, <form>, <label>",
                "location": "chemin de la balise",
                "issues": []
              }
            ],
            "images": [
              {
                "tag": "<img>",
                "location": "chemin de la balise",
                "issues": []
              }
            ]
          }
        }
      `;
    }
  
    // Afficher les résultats dans l'interface
    function displayResults(results) {
      resultsContainer.innerHTML = "";
      const resultsArray = Array.isArray(results) ? results : [results];
  
      resultsArray.forEach((result) => {
        const template = document.getElementById('result-card-template');
        const card = template.content.cloneNode(true);
        
        // Remplir les informations de base
        card.querySelector('h3').textContent = result.url || "URL non spécifiée";
        
        // Remplir les scores
        const scores = card.querySelectorAll('.text-2xl');
        scores[0].textContent = `${result.designCompliance || 0}%`;
        scores[1].textContent = `${result.techCompliance || 0}%`;
        scores[2].textContent = `${result.accessibility || 0}%`;
  
        // Remplir les éléments non conformes
        const issuesContainer = card.querySelector('details div');
        Object.entries(result.nonCompliantElements || {}).forEach(([category, elements]) => {
          if (elements && elements.length > 0) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'border-l-4 border-red-500 pl-4 py-2';
            categoryDiv.innerHTML = `
              <h4 class="font-medium text-gray-800 mb-2">${category}</h4>
              ${elements.map(element => `
                <div class="bg-gray-50 p-3 rounded-md mb-3">
                  <p class="text-sm font-medium text-gray-700">
                    ${element.tag} <span class="text-gray-500">(${element.location})</span>
                  </p>
                  <ul class="mt-2 space-y-2">
                    ${element.issues.map(issue => `
                      <li class="text-sm">
                        <span class="font-medium">${issue.property}:</span>
                        <span class="text-red-600">${issue.currentValue}</span> →
                        <span class="text-green-600">${issue.expectedValue}</span>
                        <p class="text-gray-600 mt-1">${issue.impact}</p>
                      </li>
                    `).join('')}
                  </ul>
                </div>
              `).join('')}
            `;
            issuesContainer.appendChild(categoryDiv);
          }
        });
  
        resultsContainer.appendChild(card);
      });
    }
  });
  