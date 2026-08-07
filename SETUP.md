# Publishing OwlsNestCreations.com

One-time setup, in order.

## 1. Create the repo

On github.com (logged in as EternalTime): New repository, name `owlsnestcreations`, public, no README (the folder already has one).
GitHub Pages on a free account requires the repo to be public.

## 2. Push this folder

```
cd ~/Documents/OwlsNest/website
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/EternalTime/owlsnestcreations.git
git push -u origin main
```

## 3. Turn on Pages

Repo Settings -> Pages -> Build and deployment -> Source: **GitHub Actions**.
The push in step 2 already triggered the workflow; once the source is set, the next push (or Actions -> "Deploy site to GitHub Pages" -> Run workflow) deploys.

## 4. Point the domain at GitHub

At your domain registrar, add these records:

| Type  | Host | Value |
|-------|------|-------|
| A     | @    | 185.199.108.153 |
| A     | @    | 185.199.109.153 |
| A     | @    | 185.199.110.153 |
| A     | @    | 185.199.111.153 |
| CNAME | www  | eternaltime.github.io |

## 5. Connect the domain in GitHub

Repo Settings -> Pages -> Custom domain: `owlsnestcreations.com` -> Save.
Wait for the DNS check to pass (minutes to a few hours, depending on the registrar), then check **Enforce HTTPS**.

## 6. Recommended: verify the domain

GitHub account Settings -> Pages -> Add a verified domain: `owlsnestcreations.com`.
This adds one TXT record at the registrar and prevents anyone else from claiming the domain on GitHub Pages.

## Local preview

```
bundle install
bundle exec jekyll serve
```

Then open http://localhost:4000.
