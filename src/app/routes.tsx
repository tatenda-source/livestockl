import { createBrowserRouter } from "react-router";
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
    ],
  },
  {
    path: "/auth",
    Component: AuthScreen,
  },
]);
