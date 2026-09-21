/**
 * Plugin-specific UI Components
 *
 * This directory contains UI components specifically designed for the
 * PressedMail WordPress plugin. These components extend or customize
 * the base shadcn components for plugin-specific use cases.
 *
 * Usage in the plugin:
 * import { Button, Card, cn } from '@kit/ui/plugin';
 *
 * To add new plugin-specific components:
 * 1. Create a new component file in this directory (e.g., license-status.tsx)
 * 2. Export it from this index.ts file
 * 3. The export is already configured in packages/ui/package.json
 */

// Core Components
import { Button, buttonVariants } from '../shadcn/button';
import { Badge, badgeVariants } from '../shadcn/badge';
import { Input } from './input';

export { Button, buttonVariants };
export {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  buttonGroupVariants,
} from '../shadcn/button-group';
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../shadcn/card';
export { Input };
export { Label } from '../shadcn/label';
export { Textarea } from './textarea';
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from '../shadcn/field';

// Derived type aliases (upstream removed explicit type exports)
export type ButtonProps = React.ComponentProps<typeof Button>;
export type InputProps = React.ComponentProps<typeof Input>;
export type BadgeProps = React.ComponentProps<typeof Badge>;

// Display Components
export { Badge, badgeVariants };
export { Separator } from '../shadcn/separator';
export { Skeleton } from '../shadcn/skeleton';
export { Avatar, AvatarFallback, AvatarImage } from '../shadcn/avatar';
export { Progress } from '../shadcn/progress';
export { Alert, AlertDescription, AlertTitle } from '../shadcn/alert';

// Form Components
export { Checkbox } from '../shadcn/checkbox';
export {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from '../shadcn/native-select';
export { Switch } from '../shadcn/switch';
export { RadioGroup, RadioGroupItem } from '../shadcn/radio-group';
// Use plugin-specific Select that properly inherits theme styles in portals
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';
export {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
} from '../shadcn/form';

// Overlay Components
// Use plugin-specific Dialog that properly inherits theme styles in portals
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTitleRow,
  DialogTrigger,
  overlayTitleClassName,
  overlayTitleRowClassName,
} from './dialog';
// Use plugin-specific AlertDialog that properly inherits theme styles in portals
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTitleRow,
  AlertDialogTrigger,
} from './alert-dialog';
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet';
// Use plugin-specific Popover that properly inherits theme styles in portals
export {
  Popover,
  PopoverArrow,
  PopoverContent,
  PopoverClose,
  PopoverTrigger,
  PopoverAnchor,
} from './popover';
// Use plugin-specific Tooltip that properly inherits theme styles in portals
export {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip';

// Navigation Components
export { Tabs, TabsContent, TabsList, TabsTrigger } from '../shadcn/tabs';
// Use plugin-specific DropdownMenu that properly inherits theme styles in portals
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';
// Use plugin-specific ContextMenu that properly inherits theme styles in portals
export {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './context-menu';
export {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../shadcn/accordion';
export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../shadcn/collapsible';

// Layout Components
export { ScrollArea, ScrollBar } from '../shadcn/scroll-area';
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../shadcn/table';

// Resizable Panels
export {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from './resizable';

// Chart Components
export {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
} from '../shadcn/chart';

// Command Components
// Use plugin-specific CommandDialog that properly inherits theme styles in portals
export { CommandDialog } from './command-dialog';
export {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../shadcn/command';

// Calendar
export { Calendar } from '../shadcn/calendar';

// Date/Time Inputs
export { DateInput, TimeInput, DateTimeInput } from '../shadcn/date-input';

// Date/Time Range Picker (with calendar popover)
export {
  DateTimeRangePicker,
  type DateTimeRange,
  type DateTimeRangePickerProps,
  type DateTimeRangePreset,
} from './date-time-range-picker';

// Slider
export { Slider } from '../shadcn/slider';

// Toggle
export { Toggle, toggleVariants, type ToggleProps } from './toggle';

// Sonner Toast
export { Toaster, Toaster as Sonner, toast } from './sonner';

// Plugin theme scope
export { PluginThemeScopeProvider } from './hooks/use-theme-class';
export type { PluginThemeSnapshot } from './hooks/use-theme-class';

// Re-export utilities
export { cn } from '../lib/utils';

// The plugin build may not reach src/makerkit; see packages/ui/src/core/README.md.
// Spinner is shadcn/ui's, unchanged and MIT: the MakerKit one this used to
// re-export was the same component with a different default size.
export { Spinner } from '../shadcn/spinner';
export { If } from '../core/if';

// Plugin-specific components will be added below
// Example:
// export { LicenseStatus } from './license-status';
// export { UpgradePremiumCard } from './upgrade-premium-card';
// export { FeatureGate } from './feature-gate';
