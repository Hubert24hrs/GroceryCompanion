import React from 'react';
import { Card, EmptyState, IconName } from '../ui/primitives';
import { TabScreen } from '../ui/Screen';

/** Temporary body for tabs whose screens are not built yet. */
export function ComingSoon({ title, icon, message }: { title: string; icon: IconName; message: string }) {
    return (
        <TabScreen title={title}>
            <Card>
                <EmptyState icon={icon} title="Coming next" message={message} />
            </Card>
        </TabScreen>
    );
}
