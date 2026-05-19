'use client'

import { useTransition } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { signup } from './actions'

const schema = z.object({
  workspaceName: z.string().min(1, 'Workspace-Name ist erforderlich'),
  email: z.string().email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Mindestens 8 Zeichen'),
})

type FormData = z.infer<typeof schema>

export default function SignupPage() {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { workspaceName: '', email: '', password: '' },
  })

  function onSubmit(data: FormData) {
    startTransition(async () => {
      const result = await signup(data)
      if (result?.error) {
        toast.error(result.error)
      } else {
        window.location.href = '/dashboard'
      }
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAFA]">
      <div className="w-full max-w-[400px] bg-white rounded-[6px] border border-[#E5E5E5] p-8">
        <div className="mb-8">
          <h1 className="text-[24px] font-semibold text-[#111111]">Konto erstellen</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">Starte mit Meridian</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="workspaceName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[14px] text-[#111111]">Workspace-Name</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Mahr GmbH" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[14px] text-[#111111]">E-Mail</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="name@unternehmen.de" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[14px] text-[#111111]">Passwort</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="Mindestens 8 Zeichen" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-[#E040FB] hover:bg-[#AA00FF] text-white border-0"
              disabled={isPending}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrieren...
                </span>
              ) : (
                'Registrieren'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-[14px] text-[#6B7280] mt-6">
          Bereits registriert?{' '}
          <Link href="/login" className="text-[#E040FB] hover:text-[#AA00FF] transition-colors">
            Anmelden
          </Link>
        </p>
      </div>
    </div>
  )
}
