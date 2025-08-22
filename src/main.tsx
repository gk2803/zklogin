import { StrictMode } from 'react';
import {SnackbarProvider} from 'notistack';
import { ThemeProvider } from '@mui/material/styles';
import { getFullnodeUrl } from "@mysten/sui/client";
import { SuiClientProvider, createNetworkConfig } from "@mysten/dapp-kit";
import ReactDOM from "react-dom/client";
import theme from './theme/index.ts';
import { BrowserRouter} from "react-router-dom";
import './index.css';
import App from './App.tsx';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { networkConfig } = createNetworkConfig({
  devnet: {  url: getFullnodeUrl("devnet") },
});


const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>

        <ThemeProvider theme={theme}>
          <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} network="devnet">
              <SnackbarProvider maxSnack={3} autoHideDuration={3000}>
                <BrowserRouter>
                  <App />
                </BrowserRouter>
              </SnackbarProvider>
            </SuiClientProvider>
          </QueryClientProvider>
        </ThemeProvider>        

</StrictMode>
)
