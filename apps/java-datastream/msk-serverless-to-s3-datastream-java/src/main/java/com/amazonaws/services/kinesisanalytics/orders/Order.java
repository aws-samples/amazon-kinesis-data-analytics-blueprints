package com.amazonaws.services.kinesisanalytics.orders;

import java.util.Objects;

public class Order {

    public long product_id;
    public long order_number;
    public int quantity;
    public double price;
    public String buyer;
    public String order_time;

    // need default constructor
    // to qualify as Flink POJO
    public Order() {}

    public Order(long product_id,
                 long order_number,
                 int quantity,
                 double price,
                 String buyer,
                 String order_time)
    {
        this.product_id = product_id;
        this.order_number = order_number;
        this.quantity = quantity;
        this.price = price;
        this.buyer = buyer;
        this.order_time = order_time;
    }

    @Override
    public String toString() {
        return "Order{" + "order number=" + order_number + ", price='" + price + '\'' + ", order time=" + order_time + '}';
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Order order = (Order) o;
        return order_number == order.order_number &&
                buyer.equals(order.buyer) &&
                order_time.equals(order.order_time);
    }

    @Override
    public int hashCode() {
        return Objects.hash(order_number, buyer, order_time);
    }
}