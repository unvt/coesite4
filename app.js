require("dotenv").config();

//for Server fnction
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session); //Added for session store in mysql
const flash = require("connect-flash");
const msal = require("@azure/msal-node");
var createError = require("http-errors");
const express = require("express");
const path = require("path");
var cookieParser = require("cookie-parser");
const morgan = require("morgan");
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const spdy = require("spdy"); //for https

//for File processing
const config = require("config");
const fs = require("fs");
const cors = require("cors");

// config constants
const morganFormat = config.get("morganFormat");
const logDirPath = config.get("logDirPath");
const port = config.get("port");
const privkeyPath = config.get("privkeyPath");
const fullchainPath = config.get("fullchainPath");

const htdocsPath = config.get("htdocsPath");
const defaultZ = config.get("defaultZ");
const mbtilesDir = config.get("mbtilesDir");

// logger configuration
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: `${logDirPath}/coesite-%DATE%.log`,
      datePattern: "YYYY-MM-DD",
    }),
  ],
});

logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};
// logger until here

// Development mode settings
const devMode = process.env.DEV_MODE === 'true';
if (devMode) {
  console.log('🔧 Development mode enabled - Authentication will be skipped');
}

var authRouter = require("./routes/auth"); //before app
const app = express();
// In-memory storage of logged-in users
// we will use a simple in-memory array, but in a real app,
// this in a reliable storage
app.locals.users = {};

// Setup dummy user for development mode
if (devMode) {
  const devUserId = 'dev-user-id';
  app.locals.users[devUserId] = {
    displayName: 'Development User'
  };
}

// MSAL config
const msalConfig = {
  auth: {
    clientId: process.env.OAUTH_CLIENT_ID,
    authority: process.env.OAUTH_AUTHORITY,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    //Client credential (secret, certificate, or assertion) must not be empty when creating a confidential client.
    //An application should at most have one credential
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: msal.LogLevel.Verbose,
    },
  },
};

// Create msal application object
app.locals.msalClient = new msal.ConfidentialClientApplication(msalConfig);
//(before indexRouter) until here

var indexRouter = require("./routes/index");
var mapLRouter = require("./routes/map-l"); //test 0104
var webmapLRouter = require("./routes/webmap-l");
var webmap3DRouter = require("./routes/webmap-3d");
var VTRouter = require("./routes/VT"); //test 0308
//var VTRouter = require('./routes/VT-r') //referer test
//var VTORouter = require('./routes/VT-open') //test 0322(only for development env.)
var esriIFRouter = require("./routes/esriIF"); //esri interface (tilemap, etc..)
var rgbElevRouter = require("./routes/rgbElev");

/*
// Session middleware
// NOTE: Uses default in-memory session store, which is not
// suitable for production
app.use(session({
    secret: process.env.OAUTH_CLIENT_SECRET,
    resave: false,
    saveUninitialized: false,
    unset: 'destroy'
}))

// note: session will be replaceid with mysql
*/

//session with mysql (from here)
const mysqlOptions = {
  // Enable to change the hostname of MySQL by environment variable
  host: process.env.MYSQL_HOST || "localhost",
  port: 3306,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
};
const sessionStore = new MySQLStore(mysqlOptions);
const sess = {
  secret: process.env.OAUTH_CLIENT_SECRET,
  cookie: { maxAge: 60000000 }, //16h40m
  store: sessionStore,
  resave: true, //make it true if necessary
  saveUninitialized: true, //make it true if necessary
};
//sess.cookie.secure = true //for production
app.use(session(sess));
//session with mysql (until here)

// Flash middleware
app.use(flash());

// Development mode auto-authentication middleware
if (devMode) {
  app.use(function (req, res, next) {
    // In development mode, always set a dummy user ID in session
    if (!req.session.userId) {
      req.session.userId = 'dev-user-id';
      console.log('🔑 Development mode: Auto-login performed');
    }
    next();
  });
}

// Set up local vars for template layout
app.use(function (req, res, next) {
  // Read any flashed errors and save
  // in the response locals
  res.locals.error = req.flash("error_msg");

  // Check for simple error string and
  // convert to layout's expected format
  var errs = req.flash("error");
  for (var i in errs) {
    res.locals.error.push({ message: "An error occurred", debug: errs[i] });
  }

  // Check for an authenticated user and load
  // into response locals
  if (req.session.userId) {
    res.locals.user = app.locals.users[req.session.userId];
  }

  next();
});

// view engine setup
app.set("unvt/views", path.join(__dirname, "views"));
app.set("view engine", "hbs");
app.use(
  morgan(morganFormat, {
    stream: logger.stream,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/*
// for credential
const corsOption = {
 origin: '*',
 credentials: true
}
app.options('*', cors(corsOption)) //test
app.use(cors(corsOption)) 
// for credential (unitil here)
*/
app.use(cors());

//app.use(express.static(path.join(__dirname, htdocsPath)))

app.use("/unvt", express.static("public"));
app.use("/unvt/", indexRouter);
app.use("/unvt/auth", authRouter); //after app.use('/', indexRouter)
app.use("/unvt/map-l", mapLRouter);
app.use("/unvt/webmap-l", webmapLRouter);
app.use("/unvt/webmap-3d", webmap3DRouter);
app.use("/unvt/VT", VTRouter);
//app.use('/unvt/VT-open', VTORouter)
app.use("/unvt/rest/services/esriIF", esriIFRouter); //esri interface
app.use("/unvt/rgb-elev", rgbElevRouter);

// error handler
app.use((req, res) => {
  res.sendStatus(404);
});

app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render("error");
});

// Server startup
// Toggle HTTP/HTTPS mode via environment variable
const useHttp = process.env.USE_HTTP === 'true';

if (useHttp && fs.existsSync(privkeyPath) && fs.existsSync(fullchainPath)) {
  // Start as HTTP server
  app.listen(port, () => {
    console.log(`HTTP server running at Port ${port} ...`);
  });
} else {
  // Start as HTTPS server
  spdy
    .createServer(
      {
        key: fs.readFileSync(privkeyPath),
        cert: fs.readFileSync(fullchainPath),
      },
      app
    )
    .listen(port, () => {
      console.log(`HTTPS server running at Port ${port} ...`);
    });
}
