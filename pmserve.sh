sudo pm2 stop coesite4;
sudo pm2 delete coesite4;
sudo pm2 start app.js --name coesite4;
sudo pm2 monit;