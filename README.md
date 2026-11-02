# Bretes de contenção em 3D – SafeBov e BOVICARE

Modelos 3D interativos de dois projetos de brete de contenção bovina.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `SafeBov-3D.html` | SafeBov (Projeto de Maquete – Medicina Veterinária – PUCPR). Abra com dois cliques em qualquer navegador. Funciona sem internet. |
| `BOVICARE-3D.html` | BOVICARE (brete de contenção inteligente). Mesmo funcionamento. |
| `SafeBov.glb` / `BOVICARE.glb` | Modelos para o Blender (ou PowerPoint, Windows 3D Viewer, Sketchfab). |
| `index.html` | Página inicial do link online, com os dois projetos. |
| `src/` | Código-fonte. `main.js` é o SafeBov, `bovicare.js` é o BOVICARE; os dois usam o mesmo motor de câmera e interface. |

## Link online (GitHub Pages)

Depois de ativar o GitHub Pages neste repositório, os modelos ficam em
**https://kaipyle.github.io/Imagem-3d/** e abrem em qualquer navegador, inclusive no celular.

Para ativar: no GitHub, abra o repositório › **Settings › Pages** › em *Build and deployment*,
escolha *Deploy from a branch*, selecione o branch `claude/safebov-modelo-3d` e a pasta `/ (root)`,
e clique em **Save**. O link funciona cerca de um minuto depois.

## Como apresentar

- **Arrastar**: gira o modelo · **rolar**: aproxima · **botão direito**: desloca.
- **Vistas**: perspectiva, frontal, lateral, traseira e superior.
- **Acionamentos**: cada mecanismo abre e fecha pelo painel ou pelo cartão do ponto de destaque.
  - SafeBov: cabeceira, laterais articuladas, portão traseiro.
  - BOVICARE: contenção de cabeça, painéis laterais, porta basculante, cinta abdominal, porta traseira, iluminação LED.
- **Simular manejo**: o animal entra e o brete executa a sequência completa do projeto.
- **Números sobre o modelo**: cada um explica uma funcionalidade; clicar direto numa peça também abre a explicação.
- No celular: barra de baixo com **Comandos** e **Ficha técnica**.
- Teclas: `P` modo apresentação · `F` tela cheia · `R` giro automático · `Esc` volta.

## Abrir no Blender

`File › Import › glTF 2.0 (.glb/.gltf)` e escolha o `.glb`. As peças chegam separadas, nomeadas e com materiais.

## Medidas usadas

- SafeBov: 2,80 m (da rampa de saída ao portão traseiro) × 0,90 m × 2,10 m.
- BOVICARE: 3,50 m (estrutura, sem o cocho) × 0,90 a 1,00 m × 2,10 m.

As peças não cotadas nas pranchas foram dimensionadas por proporção.

## Gerar de novo após editar

```bash
npm install
npm run build        # gera SafeBov-3D.html e BOVICARE-3D.html
```
