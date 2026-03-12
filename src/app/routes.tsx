import { createBrowserRouter, Link } from "react-router";
import { Root } from "./components/Root";
import { AuthScreen } from "./components/AuthScreen";
import { HomeFeed } from "./components/HomeFeed";
import { ItemDetail } from "./components/ItemDetail";
import { CheckoutScreen } from "./components/CheckoutScreen";
import { PaymentStatus } from "./components/PaymentStatus";
import { PostListing } from "./components/PostListing";
import { MyListings } from "./components/MyListings";
import { PaymentHistory } from "./components/PaymentHistory";
import { Notifications } from "./components/Notifications";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomeFeed },
      { path: "item/:id", Component: ItemDetail },
      {
        path: "checkout/:id",
        element: <ProtectedRoute><CheckoutScreen /></ProtectedRoute>,
      },
      {
        path: "payment-status/:ref",
        element: <ProtectedRoute><PaymentStatus /></ProtectedRoute>,
      },
      {
        path: "post",
        element: <ProtectedRoute><PostListing /></ProtectedRoute>,
      },
      {
        path: "my-listings",
        element: <ProtectedRoute><MyListings /></ProtectedRoute>,
      },
      {
        path: "payments",
        element: <ProtectedRoute><PaymentHistory /></ProtectedRoute>,
      },
      {
        path: "notifications",
        element: <ProtectedRoute><Notifications /></ProtectedRoute>,
      },
      {
        path: "*",
        element: (
          <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
            <h1 className="text-4xl font-bold mb-4">404</h1>
            <p className="text-muted-foreground mb-6">Page not found</p>
            <Link to="/" className="text-primary underline">Go back home</Link>
          </div>
        ),
      },
    ],
  },
  {
    path: "/auth",
    Component: AuthScreen,
  },
]);
