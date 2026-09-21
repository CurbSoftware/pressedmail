<?php

namespace CurbSoftware\WpEloquent\Database\Eloquent;

use CurbSoftware\WpEloquent\Contracts\Queue\EntityNotFoundException;
use CurbSoftware\WpEloquent\Contracts\Queue\EntityResolver as EntityResolverContract;

class QueueEntityResolver implements EntityResolverContract
{
    /**
     * Resolve the entity for the given ID.
     *
     * @param  string  $type
     * @param  mixed  $id
     * @return mixed
     *
     * @throws \CurbSoftware\WpEloquent\Contracts\Queue\EntityNotFoundException
     */
    public function resolve($type, $id)
    {
        $instance = (new $type)->find($id);

        if ($instance) {
            return $instance;
        }

        throw new EntityNotFoundException($type, $id);
    }
}
