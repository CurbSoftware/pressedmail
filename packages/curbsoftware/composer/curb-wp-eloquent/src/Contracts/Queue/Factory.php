<?php

namespace CurbSoftware\WpEloquent\Contracts\Queue;

interface Factory
{
    /**
     * Resolve a queue connection instance.
     *
     * @param  string|null  $name
     * @return \CurbSoftware\WpEloquent\Contracts\Queue\Queue
     */
    public function connection($name = null);
}
