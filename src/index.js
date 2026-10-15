import "./styles.css";

import React, { Suspense } from "react";
import ReactDOM from "react-dom";
import * as Sentry from "@sentry/react";
import "./i18n/i18n";

import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from "react-router-dom";
import { ThemeProvider } from "styled-components";
import theme from "./utils/theme";
import ErrorBoundary from "./components/ErrorBoundary";
import LogoFabrick from "./components/UI/LogoFabrick";

const Room1 = React.lazy(() => import("./pages/room1"));
const Hall = React.lazy(() => import("./pages/hall"));
const Fabrica = React.lazy(() => import("./pages/fabrica"));

function App() {
  return (
    <ThemeProvider theme={theme}>
      <ErrorBoundary>
      <Router>
        <div
          style={{
            position: "absolute",
            top: 32,
            left: 32,
            zIndex: 5,
            width: 100
          }}
        >
          <LogoFabrick ancho={150} />
        </div>
        <Switch>
          <Suspense fallback={null}>
            <Route path='/room-1' render={(props) => <Room1 {...props} />} />
            <Route path='/hall' render={(props) => <Hall {...props} />} />
            <Route path='/fabrica' render={(props) => <Fabrica {...props} />} />
            <Route exact path='/'>
              <Redirect to='/hall' />
            </Route>
          </Suspense>
        </Switch>
      </Router>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

Sentry.init({
  dsn:
    "https://e46328c24ae04fc895282fd9209b286d@o363032.ingest.sentry.io/5420965"
});

const rootElement = document.getElementById("root");
ReactDOM.render(<App />, rootElement);

// avisa al diagnostico de index.html de que la app arranco
setTimeout(function(){ if(window.__sfYaArranco) window.__sfYaArranco(); }, 1500);
