import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

interface UserAvatarProps {
  src?: string | null
  alt?: string
  fallback?: string
  email?: string
  firstName?: string
  lastName?: string
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
}

// Generate a consistent color based on the user's initials
const getAvatarColor = (initials: string) => {
  const colors = [
    'bg-primary text-primary-foreground', // Use the primary site color first
    'bg-blue-500 text-white',
    'bg-green-500 text-white',
    'bg-purple-500 text-white',
    'bg-pink-500 text-white',
    'bg-indigo-500 text-white',
    'bg-orange-500 text-white',
    'bg-teal-500 text-white',
    'bg-red-500 text-white',
    'bg-yellow-500 text-black',
    'bg-cyan-500 text-white',
    'bg-emerald-500 text-white',
    'bg-violet-500 text-white',
    'bg-rose-500 text-white',
    'bg-amber-500 text-black',
  ]

  // Use the first character to determine color consistently
  const charCode = initials.charCodeAt(0) || 0
  return colors[charCode % colors.length]
}

export function UserAvatar({
  src,
  alt = 'User avatar',
  fallback,
  email,
  firstName,
  lastName,
  className,
  size = 'md'
}: UserAvatarProps) {
  // Generate initials from available data
  const getInitials = () => {
    if (fallback) return fallback
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`
    if (firstName) return firstName[0]
    if (email) return email[0]
    return 'U'
  }

  const initials = getInitials().toUpperCase()
  const avatarColor = getAvatarColor(initials)

  return (
    <Avatar className={cn(sizeClasses[size], className)}>
      <AvatarImage src={src || undefined} alt={alt} />
      <AvatarFallback className={cn(
        'font-semibold select-none',
        avatarColor
      )}>
        {initials.slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
}
