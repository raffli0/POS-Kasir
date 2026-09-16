<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Order extends Model
{
    protected $fillable = [
        'no',
        'status',
        'item_count',
        'subtotal',
        'tax',
        'total',
        'method',
        'paid_at',
    ];

    protected $casts = [
        'no' => 'integer',
        'item_count' => 'integer',
        'subtotal' => 'integer',
        'tax' => 'integer',
        'total' => 'integer',
        'paid_at' => 'datetime',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(OrderItem::class);
    }

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }
}
