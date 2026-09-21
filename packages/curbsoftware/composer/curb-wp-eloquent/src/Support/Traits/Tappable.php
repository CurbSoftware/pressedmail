<?php

namespace CurbSoftware\WpEloquent\Support\Traits;

trait Tappable
{
    /**
     * Call the given Closure with this instance then return the instance.
     *
     * @param  callable|null  $callback
     * @return mixed
     */
    public function tap($callback = null)
    {
        return asdb_tap($this, $callback);
    }
}
