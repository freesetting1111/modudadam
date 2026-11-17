import { redirect } from "next/navigation";

export default function Home() {
  redirect(process.env.MODUDADAM_MAIN_URL || "http://localhost:3005/events");
}
