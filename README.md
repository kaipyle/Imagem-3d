# SafeBov – modelo 3D interativo

Brete de contenção bovina · Projeto de Maquete – Medicina Veterinária · PUCPR

## Arquivos

| Arquivo | Para quê |
|---|---|
| `SafeBov-3D.html` | Apresentação. Abra com dois cliques em qualquer navegador (Chrome, Edge, Firefox). Funciona sem internet; com internet, carrega também as fontes da identidade visual. |
| `SafeBov.glb` | Modelo 3D para o Blender (ou PowerPoint, Windows 3D Viewer, Sketchfab). |
| `src/` | Código-fonte do modelo e da página. |

## Como apresentar

- **Arrastar**: gira o modelo · **rolar**: aproxima · **botão direito**: desloca.
- **Vistas**: perspectiva, frontal, lateral, traseira e superior (as mesmas da prancha).
- **Acionamentos**: abre e fecha cabeceira, laterais e portão traseiro.
- **Simular manejo**: entrada do animal → portão traseiro fecha → cabeceira contém o pescoço → laterais abrem.
- **Números sobre o modelo**: cada um explica uma funcionalidade; clicar direto numa peça também abre a explicação.
- Teclas: `P` modo apresentação (esconde o painel) · `F` tela cheia · `R` giro automático · `Esc` volta.

## Abrir no Blender

`File › Import › glTF 2.0 (.glb/.gltf)` e escolha `SafeBov.glb`. As peças chegam separadas e nomeadas
(Estrutura, Cabeceira, Laterais articuladas, Portão traseiro, Sistema hidráulico, Painel de controle,
Degrau do operador, Animal), com materiais e o logotipo já aplicados.

## Medidas usadas

Comprimento 2,80 m (da rampa de saída ao portão traseiro) · largura 0,90 m · altura 2,10 m (topo da
estrutura; a alavanca verde passa um pouco acima). As peças não cotadas na prancha foram
dimensionadas por proporção.

## Gerar de novo após editar

```bash
npm install
npm run build        # gera SafeBov-3D.html
```
