interface PageHeaderProps {
    title: string;
    description: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
    return (
        <div className="px-10 pt-10 pb-6 border-b border-sidebar-border bg-sidebar/50 shadow-sm">
            <div className="max-w-6xl mx-auto w-full flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-sidebar-foreground mb-2 uppercase tracking-wide">{title}</h1>
                    <p className="text-sm text-sidebar-foreground/70">{description}</p>
                </div>
                {children}
            </div>
        </div>
    );
}
