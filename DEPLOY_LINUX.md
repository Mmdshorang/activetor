# Linux Deployment (Fast)

## 1) Install Docker + Compose plugin (Ubuntu)
```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

## 2) Copy project and set environment
```bash
cd /opt
sudo git clone <YOUR_REPO_URL> activetor
cd activetor
cp .env.example .env
nano .env
```

Required values in `.env`:
- `DB_NAME`
- `DB_USER`
- `DB_PASS`
- `JWT_SECRET`

## 3) Build and run
```bash
sudo docker compose up -d --build
```

## 4) Check services
```bash
sudo docker compose ps
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
```

## 5) Open firewall (if UFW enabled)
```bash
sudo ufw allow 80/tcp
sudo ufw reload
```

The app will be available on:
- `http://SERVER_IP`

## Update later
```bash
cd /opt/activetor
sudo git pull
sudo docker compose up -d --build
```
