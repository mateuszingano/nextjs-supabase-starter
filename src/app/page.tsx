import { redirect } from 'next/navigation'

// The root path is protected by the proxy; authenticated users land on notes.
export default function Home() {
  redirect('/notes')
}
