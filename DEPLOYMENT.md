# 🚀 Guia de Deploy — Snake II na Vercel + Neon

Guia passo a passo para publicar o jogo online com leaderboard compartilhado.
Ao final, você terá uma URL pública (ex: `snake-ii.vercel.app`) onde qualquer pessoa pode jogar.

---

## 📋 Pré-requisitos

- [ ] Conta no **GitHub** (grátis — https://github.com)
- [ ] Conta na **Vercel** (grátis — https://vercel.com, faça login com o GitHub)
- [ ] Conta no **Neon** (grátis — https://neon.tech, faça login com o GitHub)
- [ ] **Git** instalado no PC (https://git-scm.com)
- [ ] **Node.js 18+** instalado (para rodar `prisma db push` localmente)

> Tudo tem plano gratuito suficiente para o jogo. Você não precisa pagar nada.

---

## 🗄️ Passo 1 — Criar o banco de dados no Neon

1. Acesse **https://neon.tech** e faça login com o GitHub.
2. Clique em **"Create New Project"** (ou "New Project").
3. Preencha:
   - **Name**: `snake-ii` (ou o nome que preferir)
   - **Postgres version**: deixe a padrão (mais recente)
   - **Region**: escolha a mais próxima de você (ex: `AWS South America (São Paulo)` se disponível, senão `US East`)
4. Clique em **"Create project"**.

O Neon vai criar o banco e te mostrar a **Connection String**. Você verá uma tela com duas opções:

```
Pooled connection  →  postgresql://USER:PASS@ep-XXXX-pooler.REGION.aws.neon.tech/neondb?...
Direct connection  →  postgresql://USER:PASS@ep-XXXX.REGION.aws.neon.tech/neondb?...
```

> 💡 **Deixe essa aba aberta** — vamos usar essas duas strings em seguida.
> Se fechar, acesse: Project → **Connection Details** → aba **"Connection strings"**.

### Sobre as duas conexões
- **Pooled (porta 6543)**: usa um "pooler" (PgBouncer) — ideal para serverless (Vercel), gerencia muitas conexões curtas. Use no `DATABASE_URL`.
- **Direct (porta 5432)**: conexão direta — necessária para migrações (`prisma db push`). Use no `DIRECT_URL`.

---

## 🔑 Passo 2 — Configurar as variáveis locais

1. Na pasta do projeto, **copie o `.env.example` para `.env`**:
   ```bash
   cp .env.example .env
   ```
   No Windows (PowerShell):
   ```powershell
   Copy-Item .env.example .env
   ```

2. **Abra o `.env`** no seu editor e cole as strings do Neon:
   ```env
   # Cole aqui a POOLED connection do Neon (porta 6543)
   DATABASE_URL="postgresql://USER:PASS@ep-XXXX-pooler.REGION.aws.neon.tech/neondb?sslmode=require&pgbouncer=true"

   # Cole aqui a DIRECT connection do Neon (porta 5432)
   DIRECT_URL="postgresql://USER:PASS@ep-XXXX.REGION.aws.neon.tech/neondb?sslmode=require"
   ```

3. **Salve o arquivo.**

> ⚠️ **Nunca commite o `.env`!** Ele já está no `.gitignore` e não vai para o GitHub. As credenciais ficam só na sua máquina (e depois na Vercel).

---

## 🏗️ Passo 3 — Criar a tabela no banco (migração)

Com o `.env` configurado, rode:
```bash
bun run db:push
```
> Se você usa npm em vez de bun: `npm run db:push`

Você verá:
```
🚀 Your database is now in sync with your Prisma schema.
```

Isso cria a tabela `Score` no Neon. Pronto — o banco está estruturado.

> Para confirmar, acesse o dashboard do Neon → aba **"Tables"** → você verá a tabela `Score`.

---

## 🧪 Passo 4 — Testar localmente (opcional, recomendado)

Suba o dev server:
```bash
bun run dev
```
Abra `http://localhost:3000`, jogue uma partida e veja se o score aparece no leaderboard do menu. Se apareceu, o banco está funcionando. Pare o server com `Ctrl+C`.

---

## 📦 Passo 5 — Subir o código para o GitHub

1. **Crie um repositório no GitHub**:
   - Acesse https://github.com/new
   - **Repository name**: `snake-ii`
   - Marque **"Private"** (recomendado) ou "Public"
   - **NÃO** marque "Add a README" (o projeto já tem um)
   - Clique em **"Create repository"**

2. **No terminal, na pasta do projeto**, inicialize o git e suba:
   ```bash
   git init
   git add .
   git commit -m "Snake II - jogo da cobrinha com 5 modos e leaderboard online"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/snake-ii.git
   git push -u origin main
   ```

> Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub.

> ⚠️ Verifique que o `.env` **não** foi commitado:
> ```bash
> git status
> ```
> Se `.env` aparecer como "untracked", tudo certo — ele está ignorado. Se aparecer em "Changes to be committed", pare e confira o `.gitignore` (deve ter a linha `.env*`).

---

## ▲ Passo 6 — Conectar na Vercel

1. Acesse **https://vercel.com** e faça login com o GitHub.
2. Clique em **"Add New..." → "Project"**.
3. Na lista "Import Git Repository", encontre **`snake-ii`** e clique em **"Import"**.
4. A Vercel detecta o Next.js automaticamente. **Não mexa nas configurações de build** — deixe o padrão.

### Configurar as variáveis de ambiente (IMPORTANTE)

Antes de clicar em Deploy, expanda **"Environment Variables"** e adicione **duas**:

| Key | Value | 
|-----|-------|
| `DATABASE_URL` | *(cole aqui a POOLED connection do Neon — porta 6543)* |
| `DIRECT_URL` | *(cole aqui a DIRECT connection do Neon — porta 5432)* |

> Copie exatamente as mesmas strings do seu `.env` local.

5. Clique em **"Deploy"**.

A Vercel vai:
- Instalar dependências (rodando `postinstall` → `prisma generate` automaticamente)
- Compilar o Next.js
- Publicar o app

Leva ~2 minutos. Quando terminar, você verá **"Congratulations!"** com a URL do seu jogo (ex: `snake-ii.vercel.app`).

---

## ✅ Passo 7 — Testar o jogo online

1. Clique na URL que a Vercel te deu.
2. O jogo abre com o menu (5 modos).
3. Jogue uma partida → ao terminar, o score é enviado para o Neon.
4. Volte ao menu → o ranking mostra seu score.
5. Compartilhe a URL com amigos → eles jogam e aparecem no mesmo ranking! 🌍

---

## 🔄 Atualizações futuras

Quando você fizer mudanças no código:

```bash
git add .
git commit -m "descrição da mudança"
git push
```

A Vercel detecta o push e **redeploy automaticamente** em ~1 minuto. Você não precisa fazer nada.

### Se mudar o schema do banco (adicionar/modificar tabelas)

```bash
bun run db:push    # aplica a mudança no Neon
git add .
git commit -m "atualiza schema"
git push           # Vercel redeploya
```

---

## 🐛 Solução de problemas

### "Sorry, there was a problem deploying the code" (erro genérico de build)

Causa mais comum: o `next.config.ts` e o script `build` estavam configurados para **self-hosting** (`output: "standalone"` + comandos `cp`). A Vercel não usa esse padrão — ela tem seu próprio runtime.

**Já corrigido no projeto atual:**
- `next.config.ts`: removido `output: "standalone"`
- `package.json`: script `build` agora é só `"next build"` (sem `cp`)

Se você fez fork de uma versão antiga, confirme que esses 2 arquivos estão como acima.

### "Erro ao conectar no banco" / leaderboard vazio

- Confira se `DATABASE_URL` e `DIRECT_URL` na Vercel estão **idênticos** ao `.env` local
- A `DATABASE_URL` deve ter `?sslmode=require&pgbouncer=true` no final
- A `DIRECT_URL` deve ter `?sslmode=require` (sem `pgbouncer`)
- Veja os logs: Vercel → seu projeto → aba **"Logs"** ou **"Functions"**

### Build falha com erro do Prisma

- Confirme que o `postinstall` está no `package.json` (deve estar: `"postinstall": "prisma generate"`)
- Na Vercel: Settings → Functions → confira que está usando Node.js 18+

### "function is pending state" ao abrir o link

- É o cold start da Vercel — aguarde 5-10s e recarregue (F5). Normal em plano gratuito.

### O jogo abre mas o leaderboard dá erro

- O jogo em si não depende do banco — ele roda mesmo sem leaderboard
- Se só o leaderboard falha, é problema de conexão com o Neon (veja o primeiro item)

### Quero resetar o leaderboard (apagar todos os scores)

- Acesse o dashboard do Neon → aba **"SQL Editor"** → rode:
  ```sql
  DELETE FROM "Score";
  ```

---

## 💰 Limites do plano gratuito

| Serviço | Limite grátis | O que isso significa |
|---------|---------------|----------------------|
| **Vercel** (Hobby) | 100 GB bandwidth/mês, serverless ilimitado | Mais que suficiente para um jogo indie |
| **Neon** (Free) | 0.5 GB storage, 100 horas de compute/mês | Um leaderboard ocupa poucos KB por score — aguenta milhares |

Para um jogo da cobrinha, você dificilmente vai bater esses limites. Se um dia bater, os planos pagos começam em ~US$ 20/mês.

---

## 🎯 Resumo rápido (TL;DR)

```
1. Criar banco no Neon → copiar 2 connection strings
2. Colar no .env local → rodar `bun run db:push`
3. git init → commit → push para o GitHub
4. Vercel: Import Project → adicionar DATABASE_URL e DIRECT_URL → Deploy
5. Pronto! URL pública com leaderboard online 🐍
```

Bom deploy! 🚀
