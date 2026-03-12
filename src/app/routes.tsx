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

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: HomeFeed },
      { path: "item/:id", Component: ItemDetail },
      { path: "checkout/:id", Component: CheckoutScreen },
      { path: "payment-status/:ref", Component: PaymentStatus },
      { path: "post", Component: PostListing },
      { path: "my-listings", Component: MyListings },
      { path: "payments", Component: PaymentHistory },
      { path: "notifications", Component: Notifications },
    ],
  },
  {
    path: "/auth",
    Component: AuthScreen,
  },
]);
