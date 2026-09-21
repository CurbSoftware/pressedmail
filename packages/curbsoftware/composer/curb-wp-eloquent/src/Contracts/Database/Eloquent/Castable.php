<?php

namespace CurbSoftware\WpEloquent\Contracts\Database\Eloquent;

interface Castable
{
    /**
     * Get the name of the caster class to use when casting from / to this cast target.
     *
     * @param  array  $arguments
     * @return string
     * @return string|\CurbSoftware\WpEloquent\Contracts\Database\Eloquent\CastsAttributes|\CurbSoftware\WpEloquent\Contracts\Database\Eloquent\CastsInboundAttributes
     */
    public static function castUsing(array $arguments);
}
