<?php

namespace CurbSoftware\WpEloquent\Events;

use Closure;

if (! function_exists('CurbSoftware\WpEloquent\Events\queueable')) {
    /**
     * Create a new queued Closure event listener.
     *
     * @param  \Closure  $closure
     * @return \CurbSoftware\WpEloquent\Events\QueuedClosure
     */
    function queueable(Closure $closure)
    {
        return new QueuedClosure($closure);
    }
}
