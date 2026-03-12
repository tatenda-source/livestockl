import { createBrowserRouter, Link } from "react-router";
import { lazy, Suspense } from "react";
import { Root } from "./components/Root";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { Loader2 } from "lucide-react";

const HomeFeed = lazy(() => import('./components/HomeFeed').then(m => ({ default: m.HomeFeed })));
const AuthScreen = lazy(() => import('./components/AuthScreen').then(m => ({ default: m.AuthScreen })));
const ItemDetail = lazy(() => import('./components/ItemDetail').then(m => ({ default: m.ItemDetail })));
const CheckoutScreen = lazy(() => import('./components/CheckoutScreen').then(m => ({ default: m.CheckoutScreen })));
const PaymentStatus = lazy(() => import('./components/PaymentStatus').then(m => ({ default: m.PaymentStatus })));
const PostListing = lazy(() => import('./components/PostListing').then(m => ({ default: m.PostListing })));
const MyListings = lazy(() => import('./components/MyListings').then(m => ({ default: m.MyListings })));
const PaymentHistory = lazy(() => import('./components/PaymentHistory').then(m => ({ default: m.PaymentHistory })));
const Notifications = lazy(() => import('./components/Notifications').then(m => ({ default: m.Notifications })));
const MessagesScreen = lazy(() => import('./components/MessagesScreen').then(m => ({ default: m.MessagesScreen })));

function LazyLoad({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, element: <LazyLoad><HomeFeed /></LazyLoad> },
      { path: "item/:id", element: <LazyLoad><ItemDetail /></LazyLoad> },
      {
        path: "checkout/:id",
        element: <ProtectedRoute><LazyLoad><CheckoutScreen /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "payment-status/:ref",
        element: <ProtectedRoute><LazyLoad><PaymentStatus /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "post",
        element: <ProtectedRoute><LazyLoad><PostListing /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "my-listings",
        element: <ProtectedRoute><LazyLoad><MyListings /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "payments",
        element: <ProtectedRoute><LazyLoad><PaymentHistory /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "notifications",
        element: <ProtectedRoute><LazyLoad><Notifications /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "messages",
        element: <ProtectedRoute><LazyLoad><MessagesScreen /></LazyLoad></ProtectedRoute>,
      },
      {
        path: "messages/:conversationId",
        element: <ProtectedRoute><LazyLoad><MessagesScreen /></LazyLoad></ProtectedRoute>,
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
    element: <LazyLoad><AuthScreen /></LazyLoad>,
  },
]);
