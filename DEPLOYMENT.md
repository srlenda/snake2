# 🚀 Guia de Deploy — Snake II (Turso + Vercel)

Guia passo a passo para publicar o jogo online com leaderboard compartilhado.
Ao final, você terá uma URL pública (ex: `snake2.vercel.app`) onde qualquer pessoa pode jogar.

---

## 📋 Pré-requisitos

- [ ] Conta no **GitHub** (grátis — https://github.com)
- [ ] Conta na **Vercel** (grátis — https://vercel.com, faça login com o GitHub)
- [ ] Conta no **Turso** (grátis — https://turso.tech, faça login com o GitHub)
- [ ] O projeto **`snake2-full-project.zip`** baixado e descompactado

> Tudo tem plano gratuito suficiente para o jogo.

---

## 🗄️ Passo 1 — Criar o banco no Turso

1. Acesse **https://turso.tech** e faça login com o GitHub.
2. No painel, clique em **"Create Database"** (menu lateral esquerdo).
3. Preencha:
   - **Name**: `snake2` (ou o nome que preferir)
   - **Location**: escolha a mais próxima de você (ex: `South America` ou `US East`)
4. Clique em **"Create"**.

### Pegar a URL do banco (primeiro valor)

1. Na página do banco `snake2`, aba **"Overview"**, localize o campo **"Database URL"**.
2. Tem um endereço tipo: `libsql://snake2-seunome.aws-us-east-1.turso.io`
3. Clique em **"Copy"** (ícone de duas folhinhas).
4. Cole no seu bloco de notas com a marca "URL:".

### Criar o token de acesso (segundo valor)

1. Ainda na página do banco, clique em **"+ Create Token"** (botão verde).
2. Vai aparecer um código longo tipo: `eyJhbGciOiJFZERT...`
3. **COPIE IMEDIATAMENTE** — ele só aparece uma vez!
4. Cole no bloco de notas com a marca "TOKEN:".

> ⚠️ Você deve ter no bloco de notas:
> - **URL:** `libsql://snake2-...turso.io`
> - **TOKEN:** `eyJhbGciOi...`

---

## 🔑 Passo 2 — Configurar as variáveis locais (opcional)

> Se você só quer publicar direto na Vercel (sem testar localmente), pode pular para o Passo 4.

1. Na pasta do projeto, **copie o `.env.example` para `.env`**:
   - Windows (PowerShell): `Copy-Item .env.example .env`
   - Mac/Linux: `cp .env.example .env`

2. **Abra o `.env`** e cole os valores do Turso:
   ```env
   DATABASE_URL="libsql://snake2-seunome.turso.io"
   DATABASE_AUTH_TOKEN="eyJhbGciOi..."
   ```

3. **Salve o arquivo.**

> ⚠️ **Nunca commite o `.env`!** Ele já está no `.gitignore`.

---

## 📦 Passo 3 — Subir o código para o GitHub

1. **Crie um repositório no GitHub**:
   - Acesse https://github.com/new
   - **Repository name**: `snake2`
   - Marque **"Public"**
   - **NÃO** marque "Add a README"
   - Clique em **"Create repository"**

2. **No terminal, na pasta do projeto** (onde está o `package.json`):
   ```bash
   git init
   git add .
   git commit -m "Snake II - jogo da cobrinha com leaderboard online"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/snake2.git
   git push -u origin main
   ```
   Substitua `SEU_USUARIO` pelo seu nome de usuário do GitHub.

> 💡 Se preferir interface gráfica, use o **GitHub Desktop** (https://desktop.github.com):
> "Add local repository" → selecione a pasta → "Commit" → "Publish".

> ⚠️ Verifique que o `.env` **não** foi enviado:
> ```bash
> git status
> ```
> Se `.env` não aparecer, está certo (está no `.gitignore`).

---

## ▲ Passo 4 — Publicar na Vercel

1. Acesse **https://vercel.com** e faça login com o GitHub.
2. Clique em **"Add New..." → "Project"**.
3. Encontre **`snake2`** na lista e clique em **"Import"**.

### Configurar as variáveis de ambiente (IMPORTANTE!)

Antes de clicar em Deploy, expanda **"Environment Variables"** e adicione **duas**:

| Key | Value |
|-----|-------|
| `DATABASE_URL` | *(cole a URL do Turso — `libsql://...turso.io`)* |
| `DATABASE_AUTH_TOKEN` | *(cole o token do Turso — `eyJhbGciOi...`)* |

4. Clique em **"Deploy"**.

A Vercel vai instalar dependências, compilar e publicar. Leva ~2 minutos.
Quando aparecer "Congratulations!", o app está no ar! 🎉

---

## ⚡ Passo 5 — Configurar o banco (1 clique!)

**Isso cria a tabela no banco automaticamente. NÃO pule este passo!**

1. Abra uma nova aba no navegador
2. Digite sua URL do app seguida de `/api/setup`. Exemplo:
   ```
   https://snake2-xxxxx.vercel.app/api/setup
   ```
   (substitua `snake2-xxxxx` pela URL que a Vercel te deu)

3. Aperte **Enter**
4. Vai aparecer:
   ```json
   {"ok":true,"message":"Banco configurado! Tabela Score criada com sucesso."}
   ```
5. ✅ **Pronto!** A tabela está criada.

> Se aparecer `{"ok":false,...}`, confira se as variáveis `DATABASE_URL` e `DATABASE_AUTH_TOKEN` na Vercel estão corretas (Passo 4).

---

## ✅ Passo 6 — Jogar!

1. Volte para a URL principal do app (sem o `/api/setup`):
   ```
   https://snake2-xxxxx.vercel.app/
   ```
2. O menu abre com 5 modos de jogo.
3. Jogue uma partida → ao terminar, o score é enviado para o Turso.
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

A Vercel detecta o push e **redeploy automaticamente** em ~1 minuto.

---

## 🐛 Solução de problemas

### "Sorry, there was a problem deploying the code" (erro de build)

Causa comum: o `next.config.ts` com `output: "standalone"`. **Já corrigido** no projeto atual (sem `standalone`). Se você usou uma versão antiga, confirme que o `next.config.ts` não tem `output: "standalone"`.

### Erro 404 ao acessar `/api/setup`

A rota não existe. **Já corrigido** — o projeto agora tem `src/app/api/setup/route.ts`. Baixe a versão mais recente do `snake2-full-project.zip` e reenvie ao GitHub.

### "Banco indisponível" / leaderboard vazio

- Confira se `DATABASE_URL` e `DATABASE_AUTH_TOKEN` na Vercel estão corretos (Passo 4)
- A `DATABASE_URL` deve começar com `libsql://`
- Rode o `/api/setup` (Passo 5) para criar a tabela

### "function is pending state" ao abrir o link

- É o cold start da Vercel — aguarde 5-10s e recarregue (F5). Normal no plano gratuito.

### Quero resetar o leaderboard (apagar todos os scores)

- Acesse o painel do Turso → seu banco → aba **"SQL Editor"** → rode:
  ```sql
  DELETE FROM Score;
  ```

---

## 💰 Limites do plano gratuito

| Serviço | Limite grátis | O que significa |
|---------|---------------|----------------------|
| **Vercel** (Hobby) | 100 GB bandwidth/mês, serverless ilimitado | Suficiente para um jogo indie |
| **Turso** (Free) | 500 DBs, 9 GB total, 1 bilhão de reads/mês | Mais que suficiente |

---

## 🎯 Resumo rápido (TL;DR)

```
1. Criar banco no Turso → copiar URL + criar Token
2. Subir código para GitHub (git push)
3. Vercel: Import Project → adicionar DATABASE_URL + DATABASE_AUTH_TOKEN → Deploy
4. Acessar https://seu-app.vercel.app/api/setup → criar tabela
5. Jogar em https://seu-app.vercel.app/ 🐍
```

Bom deploy! 🚀
